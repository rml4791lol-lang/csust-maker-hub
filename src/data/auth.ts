/**
 * 成员实名账号：类型、校验、密码哈希、会话签名、管理员权限。
 * 仅服务端（scripts/admin-server.ts）与测试使用；不要在前端 .astro 里 import。
 *
 * 2026-10-28 需求（第二轮讨论）：
 *  - 邮箱 / 手机号注册（登录名），不依赖成员名单；
 *  - 实名资料：真实姓名 + 手机号 + 身份（部门成员/部长/副会长/会长/老师/合伙人/其他）；
 *  - 管理员审核；超级管理员可任命/撤销管理员；
 *  - 手机号仅管理员可见。
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Dept = '技术部' | '竞赛部' | '组织部' | '宣传部' | '创新创业部' | '其他';

export type Identity =
  | 'dept_member'
  | 'dept_lead'
  | 'vice_president'
  | 'president'
  | 'teacher'
  | 'partner'
  | 'other';

export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';
export type AdminLevel = 'super' | 'reviewer';

export interface Account {
  id: string;
  email: string;
  phone: string;
  realName: string;
  dept: Dept;
  identity: Identity;
  status: AccountStatus;
  /** 管理员等级：null/undefined = 普通成员；reviewer = 审核管理员；super = 超级管理员 */
  adminLevel?: AdminLevel | null;
  passwordHash: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  lastLoginAt?: string;
}

export const deptList: Dept[] = ['技术部', '竞赛部', '组织部', '宣传部', '创新创业部', '其他'];

export const identityLabel: Record<Identity, string> = {
  dept_member: '部门成员',
  dept_lead: '部门部长',
  vice_president: '副会长',
  president: '会长',
  teacher: '老师',
  partner: '合伙人',
  other: '其他',
};

/** 身份展示文案：部门成员 → 技术部成员；副会长 → 副会长 */
export function identityDisplay(identity: Identity, dept?: Dept): string {
  if (identity === 'dept_member') return `${dept && dept !== '其他' ? dept : '部门'}成员`;
  if (identity === 'dept_lead') return `${dept && dept !== '其他' ? dept : '部门'}部长`;
  return identityLabel[identity] ?? '其他';
}

export const adminLevelLabel: Record<AdminLevel, string> = {
  super: '超级管理员',
  reviewer: '审核管理员',
};

export function isAdmin(a: Account | null | undefined): boolean {
  return Boolean(a && a.status === 'approved' && a.adminLevel);
}

export function isSuperAdmin(a: Account | null | undefined): boolean {
  return Boolean(a && a.status === 'approved' && a.adminLevel === 'super');
}

export function publicAccount(a: Account) {
  return {
    id: a.id,
    email: a.email,
    phone: a.phone,
    realName: a.realName,
    dept: a.dept,
    identity: a.identity,
    identityLabel: identityDisplay(a.identity, a.dept),
    status: a.status,
    adminLevel: a.adminLevel ?? null,
    adminLevelLabel: a.adminLevel ? adminLevelLabel[a.adminLevel] : null,
    createdAt: a.createdAt,
    reviewedAt: a.reviewedAt,
    rejectReason: a.rejectReason,
    lastLoginAt: a.lastLoginAt,
  };
}

const scryptKeylen = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, scryptKeylen).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = String(stored || '').split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, scryptKeylen);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export interface SessionPayload {
  accountId: string;
  exp: number;
}

export function signSession(accountId: string, secret: string, ttlMs = 7 * 24 * 3600 * 1000): string {
  const payload: SessionPayload = { accountId, exp: Date.now() + ttlMs };
  const raw = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}

export function verifySession(token: string, secret: string): SessionPayload | null {
  try {
    const [raw, sig] = String(token || '').split('.');
    if (!raw || !sig) return null;
    const expected = createHmac('sha256', secret).update(raw).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload || typeof payload.accountId !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^1[3-9]\d{9}$/;

/** 注册校验：邮箱/手机号/实名/身份/密码 */
export function validateRegistration(input: {
  email?: unknown;
  phone?: unknown;
  realName?: unknown;
  password?: unknown;
  dept?: unknown;
  identity?: unknown;
}): string[] {
  const issues: string[] = [];
  const email = String(input.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) issues.push('邮箱格式不正确');
  const phone = String(input.phone ?? '').trim();
  if (!PHONE_RE.test(phone)) issues.push('手机号格式不正确（11 位）');
  const realName = String(input.realName ?? '').trim();
  if (realName.length < 2 || realName.length > 20) issues.push('真实姓名 2~20 字');
  const password = String(input.password ?? '');
  if (password.length < 8) issues.push('密码至少 8 位');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) issues.push('密码需要同时包含字母和数字');
  const identity = String(input.identity ?? '');
  const validIdentity: Identity[] = ['dept_member', 'dept_lead', 'vice_president', 'president', 'teacher', 'partner', 'other'];
  if (!validIdentity.includes(identity as Identity)) issues.push('请选择协会身份');
  const needsDept = identity === 'dept_member' || identity === 'dept_lead';
  const dept = String(input.dept ?? '其他');
  if (needsDept && !deptList.includes(dept as Dept)) issues.push('请选择所属部门');
  if (needsDept && dept === '其他') issues.push('部门成员/部长需要选择具体部门');
  return issues;
}

/** 临时密码：给管理员重置用（去掉易混淆字符） */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[randomBytes(1)[0] % chars.length];
  return out;
}
