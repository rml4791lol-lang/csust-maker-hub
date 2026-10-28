import { describe, it, expect } from 'vitest';
import {
  generateTempPassword,
  hashPassword,
  identityDisplay,
  isAdmin,
  isSuperAdmin,
  publicAccount,
  signSession,
  validateRegistration,
  verifyPassword,
  verifySession,
  type Account,
} from '../src/data/auth';

const SECRET = 'test-secret';

const validRegistration = {
  email: 'chenyu@example.com',
  phone: '13812345678',
  realName: '陈屿',
  password: 'abc12345',
  identity: 'dept_lead',
  dept: '技术部',
};

const baseAccount: Account = {
  id: 'a-1',
  email: 'chenyu@example.com',
  phone: '13812345678',
  realName: '陈屿',
  dept: '技术部',
  identity: 'dept_lead',
  status: 'approved',
  adminLevel: 'reviewer',
  passwordHash: hashPassword('abc12345'),
  createdAt: '2026-10-28T00:00:00.000Z',
};

describe('实名注册（邮箱/手机号 + 实名资料）', () => {
  it('完整资料通过校验', () => {
    expect(validateRegistration(validRegistration)).toEqual([]);
  });

  it('邮箱 / 手机号 / 姓名 格式不对会被拦', () => {
    expect(validateRegistration({ ...validRegistration, email: 'bad-email' })).toContain('邮箱格式不正确');
    expect(validateRegistration({ ...validRegistration, phone: '12345' })).toContain('手机号格式不正确（11 位）');
    expect(validateRegistration({ ...validRegistration, realName: '陈' })).toContain('真实姓名 2~20 字');
  });

  it('密码策略：至少 8 位且含字母和数字', () => {
    expect(validateRegistration({ ...validRegistration, password: 'short' })).toContain('密码至少 8 位');
    expect(validateRegistration({ ...validRegistration, password: 'abcdefgh' })).toContain('密码需要同时包含字母和数字');
  });

  it('部门成员/部长必须选具体部门；其他身份不需要', () => {
    expect(validateRegistration({ ...validRegistration, dept: '其他' })).toContain('部门成员/部长需要选择具体部门');
    expect(validateRegistration({ ...validRegistration, identity: 'president', dept: '其他' })).toEqual([]);
    expect(validateRegistration({ ...validRegistration, identity: 'teacher', dept: '其他' })).toEqual([]);
  });

  it('身份必须是预定义选项', () => {
    expect(validateRegistration({ ...validRegistration, identity: 'boss' })).toContain('请选择协会身份');
  });
});

describe('身份展示', () => {
  it('部门成员/部长拼部门，其他身份直接用名称', () => {
    expect(identityDisplay('dept_member', '技术部')).toBe('技术部成员');
    expect(identityDisplay('dept_lead', '竞赛部')).toBe('竞赛部部长');
    expect(identityDisplay('vice_president')).toBe('副会长');
    expect(identityDisplay('president')).toBe('会长');
    expect(identityDisplay('teacher')).toBe('老师');
  });
});

describe('密码与会话', () => {
  it('密码哈希可校验且不存明文', () => {
    const hash = hashPassword('abc12345');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(hash).not.toContain('abc12345');
    expect(verifyPassword('abc12345', hash)).toBe(true);
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('会话签名可验证、过期或篡改失效', () => {
    const token = signSession('a-1', SECRET, 60_000);
    expect(verifySession(token, SECRET)?.accountId).toBe('a-1');
    expect(verifySession(token, 'other-secret')).toBeNull();
    expect(verifySession(token + 'x', SECRET)).toBeNull();
    expect(verifySession(signSession('a-1', SECRET, -1000), SECRET)).toBeNull();
  });

  it('临时密码符合规则', () => {
    const pw = generateTempPassword();
    expect(pw.length).toBe(10);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe('管理员权限与公开信息', () => {
  it('普通成员不是管理员，审核/超级管理员是', () => {
    const member = { ...baseAccount, adminLevel: null };
    expect(isAdmin(member)).toBe(false);
    expect(isAdmin(baseAccount)).toBe(true);
    expect(isSuperAdmin(baseAccount)).toBe(false);
    expect(isSuperAdmin({ ...baseAccount, adminLevel: 'super' })).toBe(true);
    expect(isAdmin({ ...baseAccount, status: 'disabled' })).toBe(false);
  });

  it('公开账号信息带身份/管理员等级且不含密码哈希', () => {
    const pub = publicAccount(baseAccount) as any;
    expect(pub.passwordHash).toBeUndefined();
    expect(pub.realName).toBe('陈屿');
    expect(pub.identityLabel).toBe('技术部部长');
    expect(pub.adminLevelLabel).toBe('审核管理员');
  });
});
