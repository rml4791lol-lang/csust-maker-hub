import uploadsRaw from '../../content/uploads.json';
import type { Identity } from './auth';

export type UploadStatus = 'pending' | 'approved' | 'rejected';

export interface Upload {
  id: string;
  /** 公开访问路径，如 /photos/uploads/xxx.jpg */
  url: string;
  uploaderId: string;
  uploaderName: string;
  uploaderIdentity: Identity;
  /** 关联活动 id（可空） */
  activityId?: string;
  caption?: string;
  status: UploadStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
}

export const uploads = uploadsRaw as Upload[];

/** 部长及以上可直接上传展示；普通成员/其他需要管理员审核 */
export function canDirectUpload(identity: Identity): boolean {
  return ['dept_lead', 'vice_president', 'president', 'teacher', 'partner'].includes(identity);
}

export function approvedUploads(list: Upload[] = uploads): Upload[] {
  return [...list].filter((u) => u.status === 'approved').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function uploadsByActivity(activityId: string, list: Upload[] = uploads): Upload[] {
  return approvedUploads(list).filter((u) => u.activityId === activityId);
}

export function pendingUploads(list: Upload[] = uploads): Upload[] {
  return [...list].filter((u) => u.status === 'pending').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
