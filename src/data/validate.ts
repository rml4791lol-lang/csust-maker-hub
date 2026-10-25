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
const PUBLISH_STATES: PublishState[] = ['draft', 'reviewing', 'published', 'unpublished'];
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

/** 列表里可见的内容：已发布且未过期（过期自动下架） */
export function visibleItems(list: Item[] = items): Item[] {
  return publishedItems(list).filter((i) => !isExpired(i));
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
