import { describe, it, expect } from 'vitest';
import {
  canUpload,
  generateTempPassword,
  hashPassword,
  publicAccount,
  roleLabel,
  signSession,
  validateRegistration,
  verifyPassword,
  verifySession,
  type Account,
} from '../src/data/auth';

const SECRET = 'test-secret';
const baseAccount: Account = {
  id: 'a-1',
  memberId: 'm01',
  name: '陈屿',
  dept: '技术部',
  role: 'lead',
  requestedRole: 'lead',
  status: 'approved',
  passwordHash: hashPassword('abc12345'),
  createdAt: '2026-10-28T00:00:00.000Z',
};

describe('成员账号与实名注册', () => {
  it('姓名 + 部门与名单匹配才通过', () => {
    expect(validateRegistration({ memberId: 'm01', dept: '技术部', password: 'abc12345', role: 'member' })).toEqual([]);
    expect(validateRegistration({ memberId: 'nope', dept: '技术部', password: 'abc12345', role: 'member' })).toContain('请选择名单里的成员');
    expect(validateRegistration({ memberId: 'm01', dept: '宣传部', password: 'abc12345', role: 'member' })).toContain('部门与名单不一致');
  });

  it('密码至少 8 位且含字母和数字；角色只能自选成员/部长', () => {
    expect(validateRegistration({ memberId: 'm01', password: 'short', role: 'member' }).length).toBeGreaterThan(0);
    expect(validateRegistration({ memberId: 'm01', password: 'abcdefgh', role: 'member' })).toContain('密码需要同时包含字母和数字');
    expect(validateRegistration({ memberId: 'm01', password: 'abc12345', role: 'admin' })).toContain('申请角色只能是成员或部长');
  });

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
    const expired = signSession('a-1', SECRET, -1000);
    expect(verifySession(expired, SECRET)).toBeNull();
  });

  it('上传权限：部长及以上', () => {
    expect(canUpload('member')).toBe(false);
    expect(canUpload('lead')).toBe(true);
    expect(canUpload('admin')).toBe(true);
  });

  it('公开账号信息不含密码哈希', () => {
    const pub = publicAccount(baseAccount) as any;
    expect(pub.passwordHash).toBeUndefined();
    expect(pub.name).toBe('陈屿');
    expect(roleLabel[baseAccount.role]).toBe('部长');
  });

  it('临时密码长度与字符符合要求', () => {
    const pw = generateTempPassword();
    expect(pw.length).toBe(10);
    expect(pw).toMatch(/^[A-Za-z0-9]+$/);
  });
});
