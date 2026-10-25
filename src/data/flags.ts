import { readFileSync } from 'node:fs';

/** 受众：all 全员；core 管理员/核心；其余为部门（与 members.ts 的 depts 对齐） */
export type Audience = 'all' | 'core' | '技术部' | '宣传部' | '竞赛部' | '创新创业部';

export interface FeatureFlag {
  key: string;
  label: string;
  audience: Audience;
  enabled: boolean;
  note?: string;
}

let flags: FeatureFlag[] = [];
try {
  flags = JSON.parse(readFileSync(new URL('../../content/flags.json', import.meta.url), 'utf8'));
} catch {
  // flags.json 不存在 → 所有开关按默认开处理
}

export const featureFlags = flags;

/** 开关是否启用。未声明的 key 默认启用（新区块不用先登记开关）。 */
export function flagEnabled(key: string): boolean {
  const f = flags.find((x) => x.key === key);
  return f ? f.enabled : true;
}

export const audienceLabel: Record<Audience, string> = {
  all: '全员',
  core: '核心',
  技术部: '技术部',
  宣传部: '宣传部',
  竞赛部: '竞赛部',
  创新创业部: '创新创业部',
};
