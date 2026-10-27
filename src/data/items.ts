import content from '../../content/items.json';
import publishOverrides from './publish-state.json';

export type ItemType =
  | 'guide'      // 攻略：问题场景 → 现成路径 → 提示词 → 使用记录
  | 'skill'      // 技能指令：可复制的 agent 指令
  | 'template'   // 模板素材：可下载
  | 'link'       // 外部项目：直达链接，无详情页
  | 'training'   // 培训：通知 / 档案
  // 以下为历史类型，保留兼容，逐步迁移
  | 'project'
  | 'competition'
  | 'activity'
  | 'course'
  | 'video';

export type PublishState = 'draft' | 'reviewing' | 'published' | 'rejected' | 'unpublished';
export type ReviewMethod = 'agent' | 'human' | 'both';

export interface Item {
  id: string;
  type: ItemType;
  /** 生命周期状态：决定是否对外可见 */
  publishState: PublishState;
  /** 作者 / 整理人 */
  author?: string;
  /** 审核人 */
  reviewer?: string;
  /** 审核时间 YYYY-MM-DD */
  reviewedAt?: string;
  /** 审核方式 */
  reviewMethod?: ReviewMethod;
  /** 过期时间（YYYY-MM-DD）。到期自动从列表下架，详情页标注已截止。 */
  expiresAt?: string;
  title: string;
  summary: string;
  /** YYYY-MM-DD */
  date: string;
  status: string;
  people: string[];
  tags: string[];
  link?: string;
  extra?: {
    /** project */
    deliverable?: string;
    /** competition */
    level?: string;
    award?: string;
    team?: string;
    /** activity */
    place?: string;
    recap?: string;
    /** course */
    difficulty?: string;
    duration?: string;
    outline?: string[];
    /** video：播放器嵌入地址，留空则显示占位 */
    provider?: string;
    embedUrl?: string;
    cover?: string;
    /** guide */
    scene?: string;
    pitfalls?: string[];
    path?: string[];
    prompt?: string;
    usage?: string;
    /** skill */
    command?: string;
    appliesTo?: string;
    /** template */
    downloadUrl?: string;
    /** link */
    url?: string;
    /** 外部来源（收录自 ai.an520.xin 等） */
    sourceUrl?: string;
    sourceName?: string;
    /** training */
    kind?: 'notice' | 'archive';
    deadline?: string;
    materials?: string;
  };
}

export const typeMeta: Record<ItemType, { label: string; glyph: string; color: string }> = {
  project: { label: '项目', glyph: '项', color: '#e0632f' },
  competition: { label: '竞赛', glyph: '赛', color: '#c9a227' },
  activity: { label: '活动', glyph: '活', color: '#5e9bd6' },
  course: { label: '课程', glyph: '课', color: '#6bb08a' },
  video: { label: '视频', glyph: '播', color: '#dc2626' },
  guide: { label: '攻略', glyph: '攻', color: '#1a56db' },
  skill: { label: '技能指令', glyph: '令', color: '#0e7490' },
  template: { label: '模板素材', glyph: '模', color: '#0f766e' },
  link: { label: '外部项目', glyph: '链', color: '#b45309' },
  training: { label: '培训', glyph: '训', color: '#475569' },
};

const rawItems: Item[] = content as Item[];

/** 后台改的发布状态覆盖静态数据里的默认值 */
const overrides = publishOverrides as Record<string, PublishState>;

export const items: Item[] = rawItems.map((item) => ({
  ...item,
  publishState: overrides[item.id] ?? item.publishState,
}));

export function getItem(id: string) {
  return items.find((i) => i.id === id);
}
export function byType(t: ItemType) {
  return items.filter((i) => i.type === t);
}
export const sortedByDate = [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
