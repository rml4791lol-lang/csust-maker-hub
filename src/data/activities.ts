import type { Dept } from './members';

export interface Activity {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** 活动类型：会议 / 分享 / 参观 / 工作坊 / 其他 */
  kind: 'meeting' | 'lecture' | 'sharing' | 'visit' | 'workshop' | 'other';
  summary: string;
  /** 封面图（public 下路径或 http(s)） */
  cover: string;
  /** 更多现场照片 */
  photos?: string[];
  location?: string;
  /** 参与/组织部门 */
  depts?: Dept[];
  tags?: string[];
}

import activitiesRaw from '../../content/activities.json';

export const activityKindLabel: Record<Activity['kind'], string> = {
  meeting: '会议',
  lecture: '分享',
  sharing: '分享',
  visit: '参观',
  workshop: '工作坊',
  other: '活动',
};

export const activities = activitiesRaw as Activity[];

/** 按时间倒序 */
export function sortedActivities(list: Activity[] = activities): Activity[] {
  return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function recentActivities(limit = 4): Activity[] {
  return sortedActivities().slice(0, limit);
}
