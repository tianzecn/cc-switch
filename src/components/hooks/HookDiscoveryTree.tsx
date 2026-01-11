import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, GitBranch, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoverableHook } from "@/hooks/useHooks";

// ========== 类型定义 ==========

/** 树节点类型 */
type TreeNodeType = "repo" | "namespace" | "hook";

/** 树节点基础结构 */
interface TreeNode {
  id: string;
  name: string;
  type: TreeNodeType;
  count: number;
  children?: TreeNode[];
  hook?: DiscoverableHook;
}

/** 仓库节点（顶层） */
interface RepoNode extends TreeNode {
  type: "repo";
  owner: string;
  repoName: string;
  branch: string;
  children: NamespaceNode[];
}

/** 命名空间节点（中间层） */
interface NamespaceNode extends TreeNode {
  type: "namespace";
  namespace: string;
  children: HookNode[];
}

/** Hook 节点（叶子节点） */
interface HookNode extends TreeNode {
  type: "hook";
  hook: DiscoverableHook;
}

// ========== 工具函数 ==========

/**
 * 将扁平的 DiscoverableHook 列表转换为树形结构
 */
function buildTree(hooks: DiscoverableHook[]): RepoNode[] {
  // 按 repo 分组
  const repoMap = new Map<string, Map<string, DiscoverableHook[]>>();

  for (const hook of hooks) {
    const repoKey = `${hook.repoOwner}/${hook.repoName}`;
    const namespace = hook.namespace || "(root)";

    if (!repoMap.has(repoKey)) {
      repoMap.set(repoKey, new Map());
    }

    const namespaceMap = repoMap.get(repoKey)!;
    if (!namespaceMap.has(namespace)) {
      namespaceMap.set(namespace, []);
    }

    namespaceMap.get(namespace)!.push(hook);
  }

  // 构建树结构
  const repos: RepoNode[] = [];

  for (const [repoKey, namespaceMap] of repoMap) {
    const [owner, repoName] = repoKey.split("/");
    const firstHook = namespaceMap.values().next().value?.[0];
    const branch = firstHook?.repoBranch || "main";

    const namespaces: NamespaceNode[] = [];
    let repoCount = 0;

    // 对命名空间排序：(root) 放最前面，其他按字母排序
    const sortedNamespaces = Array.from(namespaceMap.entries()).sort(
      ([a], [b]) => {
        if (a === "(root)") return -1;
        if (b === "(root)") return 1;
        return a.localeCompare(b);
      },
    );

    for (const [namespace, hookList] of sortedNamespaces) {
      const hookNodes: HookNode[] = hookList
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((hook) => ({
          id: hook.key,
          name: hook.filename,
          type: "hook" as const,
          count: 0,
          hook,
        }));

      namespaces.push({
        id: `${repoKey}/${namespace}`,
        name: namespace === "(root)" ? "hooks" : namespace,
        type: "namespace",
        namespace,
        count: hookList.length,
        children: hookNodes,
      });

      repoCount += hookList.length;
    }

    repos.push({
      id: repoKey,
      name: repoKey,
      type: "repo",
      owner,
      repoName,
      branch,
      count: repoCount,
      children: namespaces,
    });
  }

  // 按仓库名排序
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

// ========== 组件 Props ==========

interface HookDiscoveryTreeProps {
  hooks: DiscoverableHook[];
  /** 选中的命名空间 ID（格式: owner/repo/namespace） */
  selectedNamespace: string | null;
  /** 命名空间被选中时的回调 */
  onSelectNamespace: (namespaceId: string, hooks: DiscoverableHook[]) => void;
  /** 手风琴模式：当前展开的仓库 ID（只能展开一个） */
  expandedRepoId?: string | null;
  /** 展开状态变化回调 */
  onExpandedChange?: (repoId: string | null) => void;
}

/**
 * Hook 发现树组件
 * 以 repo → namespace 的层级结构展示，点击命名空间在右侧显示 hook 列表
 */
export const HookDiscoveryTree: React.FC<HookDiscoveryTreeProps> = ({
  hooks,
  selectedNamespace,
  onSelectNamespace,
  expandedRepoId: controlledExpandedRepoId,
  onExpandedChange: controlledExpandedChange,
}) => {
  const { t } = useTranslation();

  // 手风琴模式：内部展开状态（只能展开一个仓库）
  const [internalExpandedRepoId, setInternalExpandedRepoId] = React.useState<
    string | null
  >(null);

  const expandedRepoId = controlledExpandedRepoId ?? internalExpandedRepoId;
  const setExpandedRepoId =
    controlledExpandedChange ?? setInternalExpandedRepoId;

  // 构建树结构
  const tree = useMemo(() => buildTree(hooks), [hooks]);

  // 点击仓库：手风琴模式切换展开状态
  const handleRepoClick = (repoId: string) => {
    if (expandedRepoId === repoId) {
      // 当前仓库已展开 -> 折叠
      setExpandedRepoId(null);
    } else {
      // 展开新仓库，折叠其他（手风琴模式）
      setExpandedRepoId(repoId);
    }
  };

  // 处理命名空间选中（确保仓库展开）
  const handleSelectNamespace = (repoId: string, node: NamespaceNode) => {
    // 确保仓库展开
    setExpandedRepoId(repoId);
    const hookList = node.children.map((c) => c.hook);
    onSelectNamespace(node.id, hookList);
  };

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("hooks.noReposConfigured")}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((repo) => (
        <RepoTreeNode
          key={repo.id}
          node={repo}
          isExpanded={expandedRepoId === repo.id}
          onRepoClick={() => handleRepoClick(repo.id)}
          selectedNamespace={selectedNamespace}
          onSelectNamespace={(ns) => handleSelectNamespace(repo.id, ns)}
        />
      ))}
    </div>
  );
};

// ========== 子组件 ==========

interface RepoTreeNodeProps {
  node: RepoNode;
  isExpanded: boolean;
  onRepoClick: () => void;
  selectedNamespace: string | null;
  onSelectNamespace: (node: NamespaceNode) => void;
}

const RepoTreeNode: React.FC<RepoTreeNodeProps> = ({
  node,
  isExpanded,
  onRepoClick,
  selectedNamespace,
  onSelectNamespace,
}) => {
  return (
    <div>
      {/* Repo Header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
        onClick={onRepoClick}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <GitBranch size={14} className="text-orange-500" />
        <span className="flex-1 text-sm font-medium truncate">{node.name}</span>
        <span className="text-xs text-muted-foreground">{node.count}</span>
      </div>

      {/* Children - 命名空间列表 */}
      {isExpanded && (
        <div className="ml-4 border-l border-border/50 pl-2">
          {node.children.map((ns) => (
            <NamespaceTreeNode
              key={ns.id}
              node={ns}
              isSelected={selectedNamespace === ns.id}
              onSelect={() => onSelectNamespace(ns)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface NamespaceTreeNodeProps {
  node: NamespaceNode;
  isSelected: boolean;
  onSelect: () => void;
}

const NamespaceTreeNode: React.FC<NamespaceTreeNodeProps> = ({
  node,
  isSelected,
  onSelect,
}) => {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground",
      )}
      onClick={onSelect}
    >
      <Folder
        size={14}
        className={isSelected ? "text-primary" : "text-orange-500"}
      />
      <span className="flex-1 text-sm truncate">{node.name}</span>
      <span className="text-xs text-muted-foreground">{node.count}</span>
    </div>
  );
};

export default HookDiscoveryTree;
