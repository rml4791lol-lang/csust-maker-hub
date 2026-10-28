import membersRaw from '../../content/members.json';

export type Dept = '技术部' | '竞赛部' | '组织部' | '宣传部' | '创新创业部' | '其他';

export interface Member {
  id: string;
  name: string;
  dept: Dept;
  role?: string;
  grade: string;
  skills: string[];
  /** 关联的内容 id */
  projects: string[];
  bio?: string;
}

export const depts: Dept[] = ['技术部', '竞赛部', '组织部', '宣传部', '创新创业部', '其他'];

/**
 * 成员数据源：content/members.json。
 * 初始为演示数据（pnpm seed:members 可重置）；管理端「同步成员档案」会用审核通过的账号覆盖它，重新构建后前台生效。
 */
export const members = membersRaw as Member[];

export function memberById(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

export function memberExists(id: string): boolean {
  return members.some((m) => m.id === id);
}
