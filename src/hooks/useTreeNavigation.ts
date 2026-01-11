import { useCallback, useState } from "react";
import {
  type TreeSelection,
  createAllSelection,
  createRepoSelection,
  createNamespaceSelection,
} from "@/types/tree";

/**
 * 手风琴导航状态管理 Hook
 *
 * 特性：
 * 1. 同一时间只有一个仓库处于展开状态（手风琴模式）
 * 2. 点击未展开的仓库 -> 展开该仓库，折叠其他，自动选中
 * 3. 再次点击已展开的仓库 -> 折叠该仓库，清空选中
 * 4. 点击命名空间 -> 选中该命名空间（仓库保持展开）
 */
export interface UseTreeNavigationOptions {
  /** 初始展开的仓库 ID（可选，默认不展开） */
  initialExpandedRepo?: string;
  /** 初始选中状态（可选，默认全部） */
  initialSelection?: TreeSelection;
  /** 选中状态变化回调 */
  onSelectionChange?: (selection: TreeSelection) => void;
}

export interface UseTreeNavigationReturn {
  /** 当前展开的仓库 ID（null 表示无展开） */
  expandedRepoId: string | null;
  /** 当前选中状态 */
  selection: TreeSelection;
  /** 切换仓库展开状态（手风琴模式） */
  toggleRepo: (repoId: string) => void;
  /** 选中命名空间 */
  selectNamespace: (repoId: string, namespaceId: string) => void;
  /** 选中全部 */
  selectAll: () => void;
  /** 判断仓库是否展开 */
  isRepoExpanded: (repoId: string) => boolean;
  /** 直接设置选中状态 */
  setSelection: (selection: TreeSelection) => void;
}

export function useTreeNavigation(
  options: UseTreeNavigationOptions = {},
): UseTreeNavigationReturn {
  const {
    initialExpandedRepo = null,
    initialSelection = createAllSelection(),
    onSelectionChange,
  } = options;

  // 展开状态：只允许一个仓库展开（手风琴模式）
  const [expandedRepoId, setExpandedRepoId] = useState<string | null>(
    initialExpandedRepo,
  );

  // 选中状态
  const [selection, setSelectionState] =
    useState<TreeSelection>(initialSelection);

  // 更新选中状态，同时触发回调
  const setSelection = useCallback(
    (newSelection: TreeSelection) => {
      setSelectionState(newSelection);
      onSelectionChange?.(newSelection);
    },
    [onSelectionChange],
  );

  // 切换仓库展开状态（手风琴模式）
  const toggleRepo = useCallback(
    (repoId: string) => {
      setExpandedRepoId((current) => {
        if (current === repoId) {
          // 当前仓库已展开 -> 折叠并清空选中
          setSelection(createAllSelection());
          return null;
        } else {
          // 展开新仓库，折叠其他，自动选中该仓库
          setSelection(createRepoSelection(repoId));
          return repoId;
        }
      });
    },
    [setSelection],
  );

  // 选中命名空间
  const selectNamespace = useCallback(
    (repoId: string, namespaceId: string) => {
      // 确保仓库展开
      setExpandedRepoId(repoId);
      setSelection(createNamespaceSelection(repoId, namespaceId));
    },
    [setSelection],
  );

  // 选中全部
  const selectAll = useCallback(() => {
    setExpandedRepoId(null);
    setSelection(createAllSelection());
  }, [setSelection]);

  // 判断仓库是否展开
  const isRepoExpanded = useCallback(
    (repoId: string) => expandedRepoId === repoId,
    [expandedRepoId],
  );

  return {
    expandedRepoId,
    selection,
    toggleRepo,
    selectNamespace,
    selectAll,
    isRepoExpanded,
    setSelection,
  };
}

export default useTreeNavigation;
