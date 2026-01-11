/**
 * 树形导航选中状态类型定义
 * 用于 Skills、Commands、Hooks、Agents 模块的统一树状选中管理
 */

/** 选中类型 */
export type SelectionType = "all" | "repo" | "namespace";

/**
 * 树选中状态
 * - type: "all" - 全部视图
 * - type: "repo" - 选中仓库，repoId 必填
 * - type: "namespace" - 选中命名空间，repoId 和 namespaceId 必填
 */
export interface TreeSelection {
  type: SelectionType;
  /** 仓库 ID (如 "owner/repo" 或 "local") */
  repoId?: string;
  /** 命名空间 ID (如 "owner/repo/namespace" 或直接是命名空间名称) */
  namespaceId?: string;
}

/** 创建 "全部" 选中状态 */
export function createAllSelection(): TreeSelection {
  return { type: "all" };
}

/** 创建仓库选中状态 */
export function createRepoSelection(repoId: string): TreeSelection {
  return { type: "repo", repoId };
}

/** 创建命名空间选中状态 */
export function createNamespaceSelection(
  repoId: string,
  namespaceId: string,
): TreeSelection {
  return { type: "namespace", repoId, namespaceId };
}

/** 判断是否选中全部 */
export function isAllSelected(selection: TreeSelection): boolean {
  return selection.type === "all";
}

/** 判断是否选中指定仓库 */
export function isRepoSelected(
  selection: TreeSelection,
  repoId: string,
): boolean {
  return selection.type === "repo" && selection.repoId === repoId;
}

/** 判断是否选中指定命名空间 */
export function isNamespaceSelected(
  selection: TreeSelection,
  namespaceId: string,
): boolean {
  return (
    selection.type === "namespace" && selection.namespaceId === namespaceId
  );
}
