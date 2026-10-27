// ============================================================
// 状态流转规则：防止审核被绕过
// ============================================================

/**
 * 足迹状态机：
 *   draft   → pending            （提交）
 *   pending → approved | draft   （通过 / 打回）
 *   approved                     （终态，只能删除）
 */
export const CONTRIBUTION_FLOW: Record<string, string[]> = {
  draft: ["pending"],
  pending: ["approved", "draft"],
  approved: [],
};

/** 项目状态机：允许前进，也允许退回一步修正 */
export const PROJECT_FLOW: Record<string, string[]> = {
  立项: ["开发中", "已结项"],
  开发中: ["答辩准备", "立项", "已结项"],
  答辩准备: ["已结项", "开发中"],
  已结项: ["孵化中"],
  孵化中: [],
};

export function canTransition(
  flow: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  return (flow[from] ?? []).includes(to);
}

/** 各表的流转规则（没有定义的表不限制） */
export const FLOWS: Record<
  string,
  { field: string; flow: Record<string, string[]>; label: string }
> = {
  contributions: {
    field: "status",
    flow: CONTRIBUTION_FLOW,
    label: "足迹状态",
  },
  projects: { field: "status", flow: PROJECT_FLOW, label: "项目状态" },
};
