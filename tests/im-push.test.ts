import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { feishuSign } from '../scripts/im-push';

describe('feishuSign（飞书机器人签名）', () => {
  it('输出为合法 base64 且解码后 32 字节（HmacSHA256 摘要长度）', () => {
    const sign = feishuSign(1760000000, 'test-secret');
    expect(sign).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(Buffer.from(sign, 'base64').length).toBe(32);
  });

  it('同输入同输出（可复现）', () => {
    expect(feishuSign(1760000000, 'test-secret')).toBe(feishuSign(1760000000, 'test-secret'));
    expect(feishuSign(1760000000, 'test-secret')).not.toBe(feishuSign(1760000001, 'test-secret'));
  });

  it('与 node:crypto 按飞书规则独立重算一致（key = timestamp\\nsecret，内容空串）', () => {
    for (const [ts, secret] of [
      [1760000000, 'test-secret'],
      [1700000000, ''],
      [1234567890, '含中文的密钥'],
    ] as [number, string][]) {
      const expected = createHmac('sha256', `${ts}\n${secret}`).update('').digest('base64');
      expect(feishuSign(ts, secret)).toBe(expected);
    }
  });
});
