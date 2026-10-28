/**
 * 成员实名账号：类型、校验、密码哈希、会话签名。
 * 仅服务端（scripts/admin-server.ts）与测试使用；不要在前端 .astro 里 import。
 *
 * 需求（2026-10-28 讨论定稿）：
 *  - 成员自助注册，姓名 + 部门与名单匹配；
 *  - 管理员审核后生效，并核定角色（成员 / 部长 / 管理员）；
 *  - 登录后投稿，身份自动带出；
 *  - 上传权限：部长及以上。
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { members, type Dept } from './members';

export type Role = 'member' | 'lead' | 'admin';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export interface Account {
  id: string;
  /** 绑定成员名单的 id（一个成员只能有一个账号） */
  memberId: string;
  name: string;
  dept: Dept;
  /** 实际角色（管理员审核时核定） */
  role: Role;
  /** 注册时申请的角色（审核参考） */
  requestedRole: Role;
  status: AccountStatus;
  passwordHash: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  lastLoginAt?: string;
}

export const roleLabel: Record<Role, string> = {
  member: '成员',
  lead: '部长',
  admin: '管理员',
};

export const roleLevel: Record<Role, number> = { member: 1, lead: 2, admin: 3 };

/** 上传权限：部长及以上 */
export function canUpload(role: Role): boolean {
  return roleLevel[role] >= 2;
}

export function isRole(v: unknown): v is Role {
  return v === 'member' || v === 'lead' || v === 'admin';
}

/** 公开展示用账号信息（绝不含密码哈希） */
export function publicAccount(a: Account) {
  return {
    id: a.id,
    memberId: a.memberId,
    name: a.name,
    dept: a.dept,
    role: a.role,
    status: a.status,
    createdAt: a.createdAt,
    reviewedAt: a.reviewedAt,
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

/** 注册校验：姓名 + 部门与名单匹配；密码至少 8 位且含字母和数字；角色只允许成员/部长自选 */
export function validateRegistration(
  input: { memberId?: unknown; dept?: unknown; password?: unknown; role?: unknown },
  memberList = members
): string[] {
  const issues: string[] = [];
  const memberId = String(input.memberId ?? '');
  const member = memberList.find((m) => m.id === memberId);
  if (!member) issues.push('请选择名单里的成员');
  else if (input.dept != null && String(input.dept) !== member.dept) issues.push('部门与名单不一致');
  const password = String(input.password ?? '');
  if (password.length < 8) issues.push('密码至少 8 位');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) issues.push('密码需要同时包含字母和数字');
  const role = input.role == null ? 'member' : String(input.role);
  if (!['member', 'lead'].includes(role)) issues.push('申请角色只能是成员或部长');
  return issues;
}

/** 临时密码：给管理员重置用（去掉易混淆字符） */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[randomBytes(1)[0] % chars.length];
  return out;
}
