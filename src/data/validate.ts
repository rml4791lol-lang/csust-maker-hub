import type { Item, ItemType, PublishState } from './items';
import type { Member } from './members';
import { typeMeta } from './items';
import { members } from './members';
import { items } from './items';

export type ValidationIssue = {
  level: 'error' | 'warn';
  code: string;
  id?: string;
  field?: string;
  message: string;
};

const ITEM_TYPES = Object.keys(typeMeta) as ItemType[];
const PUBLISH_STATES: PublishState[] = ['draft', 'reviewing', 'published', 'rejected', 'unpublished'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ContentInput {
  items: Item[];
  members: Member[];
}

/**
 * 校验内容数据。只接受普通数据，便于用构造数据测试。
 * 返回空数组表示通过。
 */
export function validateContent(input: ContentInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { items, members } = input;

  const itemIds = new Set<string>();
  const memberNames = new Set(members.map((m) => m.name));
  const memberIds = new Set(members.map((m) => m.id));

  for (const item of items) {
    const id = item?.id ?? '(无 id)';

    for (const field of ['id', 'title', 'summary', 'date', 'type', 'publishState'] as const) {
      const v = (item as any)?.[field];
      if (v === undefined || v === null || String(v).trim() === '') {
        issues.push({
          level: 'error',
          code: 'missing-field',
          id,
          field,
          message: `条目 ${id} 缺必填字段 ${field}`,
        });
      }
    }

    const author = (item as any)?.author;
    if (author === undefined || author === null || String(author).trim() === '') {
      issues.push({
        level: 'warn',
        code: 'missing-author',
        id,
        field: 'author',
        message: `条目 ${id} 缺作者`,
      });
    }

    if (item.id) {
      if (itemIds.has(item.id)) {
        issues.push({
          level: 'error',
          code: 'duplicate-id',
          id,
          field: 'id',
          message: `条目 id 重复：${item.id}`,
        });
      }
      itemIds.add(item.id);
    }

    if (item.type && !ITEM_TYPES.includes(item.type)) {
      issues.push({
        level: 'error',
        code: 'invalid-type',
        id,
        field: 'type',
        message: `条目 ${id} 的类型 ${String(item.type)} 不在允许集合内`,
      });
    }

    if (item.publishState && !PUBLISH_STATES.includes(item.publishState)) {
      issues.push({
        level: 'error',
        code: 'invalid-publish-state',
        id,
        field: 'publishState',
        message: `条目 ${id} 的生命周期状态 ${String(item.publishState)} 不合法`,
      });
    }

    if (item.date && !DATE_RE.test(item.date)) {
      issues.push({
        level: 'error',
        code: 'invalid-date',
        id,
        field: 'date',
        message: `条目 ${id} 的日期 ${item.date} 不是 YYYY-MM-DD`,
      });
    }

    const extra = (item.extra ?? {}) as Record<string, unknown>;
    const isText = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

    // 类型专属字段：缺了就算 error，避免 API/人工写入半成品后进构建
    if (item.type === 'guide') {
      const sections: [string, string][] = [
        ['scene', '问题场景'],
        ['path', '现成路径'],
        ['prompt', '可复制提示词'],
        ['pitfalls', '常见错误'],
        ['usage', '使用记录'],
      ];
      for (const [key, label] of sections) {
        const v = extra[key];
        const ok = Array.isArray(v) ? v.length > 0 : isText(v);
        if (!ok) {
          issues.push({
            level: 'error',
            code: 'missing-guide-section',
            id,
            field: `extra.${key}`,
            message: `攻略 ${id} 缺「${label}」（五段结构必填）`,
          });
        }
      }
      const path = extra.path;
      if (Array.isArray(path) && (path.length < 3 || path.some((s) => !isText(s)))) {
        issues.push({
          level: 'error',
          code: 'bad-guide-path',
          id,
          field: 'extra.path',
          message: `攻略 ${id} 的「现成路径」至少 3 步，且每步不能为空`,
        });
      }
      const pitfalls = extra.pitfalls;
      if (Array.isArray(pitfalls) && pitfalls.length < 3) {
        issues.push({
          level: 'error',
          code: 'bad-guide-pitfalls',
          id,
          field: 'extra.pitfalls',
          message: `攻略 ${id} 的「常见错误」至少 3 条（内容标准：3 条真坑）`,
        });
      }
      if (isText(extra.usage) && String(extra.usage).includes('[待补充]')) {
        issues.push({
          level: 'warn',
          code: 'placeholder-usage',
          id,
          field: 'extra.usage',
          message: `攻略 ${id} 的「使用记录」仍是占位符 [待补充]，有实测数据后请回填`,
        });
      }
    } else if (item.type === 'skill') {
      if (!isText(extra.command)) {
        issues.push({ level: 'error', code: 'missing-skill-command', id, field: 'extra.command', message: `技能指令 ${id} 缺指令正文 command` });
      }
      if (!isText(extra.appliesTo)) {
        issues.push({ level: 'error', code: 'missing-skill-applies-to', id, field: 'extra.appliesTo', message: `技能指令 ${id} 缺适用 agent appliesTo` });
      }
    } else if (item.type === 'template') {
      if (!isText(extra.downloadUrl)) {
        issues.push({ level: 'error', code: 'missing-download-url', id, field: 'extra.downloadUrl', message: `模板 ${id} 缺下载地址 downloadUrl` });
      } else if (!/^(https?:\/\/|\/)/.test(String(extra.downloadUrl))) {
        issues.push({ level: 'error', code: 'invalid-download-url', id, field: 'extra.downloadUrl', message: `模板 ${id} 的 downloadUrl 必须 / 开头或 http(s) 地址` });
      }
    } else if (item.type === 'link') {
      if (!isText(extra.url)) {
        issues.push({ level: 'error', code: 'missing-link-url', id, field: 'extra.url', message: `外部项目 ${id} 缺链接 url` });
      } else if (!/^https?:\/\//.test(String(extra.url))) {
        issues.push({ level: 'error', code: 'invalid-link-url', id, field: 'extra.url', message: `外部项目 ${id} 的 url 必须 http(s) 开头` });
      }
    } else if (item.type === 'training') {
      if (!['notice', 'archive'].includes(String(extra.kind))) {
        issues.push({ level: 'error', code: 'bad-training-kind', id, field: 'extra.kind', message: `培训 ${id} 的 kind 必须是 notice 或 archive` });
      }
      if (extra.kind === 'notice' && !DATE_RE.test(String(extra.deadline ?? ''))) {
        issues.push({ level: 'error', code: 'missing-training-deadline', id, field: 'extra.deadline', message: `培训通知 ${id} 缺报名截止 deadline（YYYY-MM-DD）` });
      }
    }

    if (isText(extra.sourceUrl) && !/^https?:\/\//.test(String(extra.sourceUrl))) {
      issues.push({ level: 'error', code: 'invalid-source-url', id, field: 'extra.sourceUrl', message: `${id} 的 sourceUrl 必须是 http(s) 地址` });
    }

    for (const name of item.people ?? []) {
      if (!memberNames.has(name)) {
        issues.push({
          level: 'error',
          code: 'unknown-person',
          id,
          field: 'people',
          message: `条目 ${id} 引用了不存在的成员：${name}`,
        });
      }
    }
  }

  for (const m of members) {
    if (!memberIds.has(m.id)) continue;
    for (const pid of m.projects ?? []) {
      if (!itemIds.has(pid)) {
        issues.push({
          level: 'error',
          code: 'unknown-project',
          id: m.id,
          field: 'projects',
          message: `成员 ${m.name} 引用了不存在的内容：${pid}`,
        });
      }
    }
  }

  return issues;
}

/** 用仓库里的真实数据跑一遍校验 */
export function validateCurrentContent(): ValidationIssue[] {
  return validateContent({ items, members });
}

/** 对外可见的内容：只有已发布 */
export function publishedItems(list: Item[] = items): Item[] {
  return list.filter((i) => i.publishState === 'published');
}

/** 是否已过期 */
export function isExpired(item: Item, now = new Date()): boolean {
  if (!item.expiresAt) return false;
  return new Date(item.expiresAt + 'T23:59:59') < now;
}

/** 即将到期的内容（14 天内），用于后台提醒 */
export function expiringSoon(list: Item[] = items, days = 14): Item[] {
  const now = new Date();
  const limit = new Date(now.getTime() + days * 864e5);
  return publishedItems(list).filter((i) => {
    if (!i.expiresAt) return false;
    const d = new Date(i.expiresAt + 'T23:59:59');
    return d >= now && d <= limit;
  });
}
