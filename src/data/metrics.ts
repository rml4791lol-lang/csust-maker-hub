import { readFileSync } from 'node:fs';

/**
 * 运行时指标（浏览量 / 反馈），由后台服务写入仓库根目录的 metrics.json。
 * 该文件只存在于线上服务器（已 gitignore），构建时读到什么就渲染什么；
 * 本地开发没有这个文件，全部按 0 处理。
 */
export interface Metrics {
  views: Record<string, number>;
  feedback: { item: string; vote: 'useful' | 'useless' | 'confirmed'; note?: string; at: string }[];
  updatedAt?: string;
}

let data: Metrics = { views: {}, feedback: [] };
try {
  const raw = JSON.parse(readFileSync(new URL('../../metrics.json', import.meta.url), 'utf8'));
  data = { views: {}, feedback: [], ...raw };
} catch {
  // metrics.json 不存在（本地开发 / 首次部署）
}

export const metrics = data;
export const viewCount = (id: string) => data.views[id] ?? 0;
export const totalViews = () => Object.values(data.views).reduce((a, b) => a + b, 0);
