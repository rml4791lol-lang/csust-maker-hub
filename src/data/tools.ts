import { readFileSync } from 'node:fs';
import type { Audience } from './flags';

export type ToolKind = 'tool' | 'api' | 'internal';
export type ToolStatus = '正常' | '维护中' | '已下线';

export interface ToolEntry {
  name: string;
  url: string;
  kind: ToolKind;
  desc: string;
  audience: Audience;
  status?: ToolStatus;
}

let tools: ToolEntry[] = [];
try {
  tools = JSON.parse(readFileSync(new URL('../../content/tools.json', import.meta.url), 'utf8'));
} catch {
  // tools.json 不存在 → 页面空态
}

const KIND_ORDER: ToolKind[] = ['tool', 'api', 'internal'];
export const kindLabel: Record<ToolKind, string> = { tool: '工具站', api: 'API', internal: '内部' };

/** 按分组排序后的工具清单（分组内按名称） */
export const groupedTools = KIND_ORDER.map((kind) => ({
  kind,
  label: kindLabel[kind],
  items: tools.filter((t) => t.kind === kind).sort((a, b) => a.name.localeCompare(b.name, 'zh')),
})).filter((g) => g.items.length > 0);
