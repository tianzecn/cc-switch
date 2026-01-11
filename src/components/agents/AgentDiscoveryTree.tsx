import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, GitBranch, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoverableAgent } from "@/hooks/useAgents";

// ========== 类型定义 ==========

/** 树节点类型 */
type TreeNodeType = "repo" | "namespace" | "agent";

/** 树节点基础结构 */
interface TreeNode {
  id: string;
  name: string;
  type: TreeNodeType;
  count: number;
  children?: TreeNode[];
  agent?: DiscoverableAgent;
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
  children: AgentNode[];
}

/** Agent 节点（叶子节点） */
interface AgentNode extends TreeNode {
  type: "agent";
  agent: DiscoverableAgent;
}

// ========== 工具函数 ==========

/**
 * 将扁平的 DiscoverableAgent 列表转换为树形结构
 */
function buildTree(agents: DiscoverableAgent[]): RepoNode[] {
  // 按 repo 分组
  const repoMap = new Map<string, Map<string, DiscoverableAgent[]>>();

  for (const agent of agents) {
    const repoKey = `${agent.repoOwner}/${agent.repoName}`;
    const namespace = agent.namespace || "(root)";

    if (!repoMap.has(repoKey)) {
      repoMap.set(repoKey, new Map());
    }

    const namespaceMap = repoMap.get(repoKey)!;
    if (!namespaceMap.has(namespace)) {
      namespaceMap.set(namespace, []);
    }

    namespaceMap.get(namespace)!.push(agent);
  }

  // 构建树结构
  const repos: RepoNode[] = [];

  for (const [repoKey, namespaceMap] of repoMap) {
    const [owner, repoName] = repoKey.split("/");
    const firstAgent = namespaceMap.values().next().value?.[0];
    const branch = firstAgent?.repoBranch || "main";

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

    for (const [namespace, agentList] of sortedNamespaces) {
      const agentNodes: AgentNode[] = agentList
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((agent) => ({
          id: agent.key,
          name: agent.filename,
          type: "agent" as const,
          count: 0,
          agent,
        }));

      namespaces.push({
        id: `${repoKey}/${namespace}`,
        name: namespace === "(root)" ? "agents" : namespace,
        type: "namespace",
        namespace,
        count: agentList.length,
        children: agentNodes,
      });

      repoCount += agentList.length;
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

/** 选择类型 */
export type DiscoverySelectionType = "all" | "repo" | "namespace";

/** 选择状态 */
export interface DiscoverySelection {
  type: DiscoverySelectionType;
  id: string | null;
  agents: DiscoverableAgent[];
}

interface AgentDiscoveryTreeProps {
  agents: DiscoverableAgent[];
  /** 当前选择状态 */
  selection: DiscoverySelection;
  /** 选择变化回调 */
  onSelectionChange: (selection: DiscoverySelection) => void;
  expandedNodes?: Set<string>;
  onToggleNode?: (nodeId: string) => void;
}

/**
 * Agent 发现树组件
 * 以 repo → namespace 的层级结构展示
 * 点击仓库：展开 + 显示该仓库下所有 agents
 * 点击命名空间：显示该命名空间下的 agents
 */
export const AgentDiscoveryTree: React.FC<AgentDiscoveryTreeProps> = ({
  agents,
  selection,
  onSelectionChange,
  expandedNodes: controlledExpanded,
  onToggleNode: controlledToggle,
}) => {
  const { t } = useTranslation();

  // 内部展开状态（如果没有外部控制）
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(
    new Set(),
  );

  const expanded = controlledExpanded ?? internalExpanded;
  const toggleNode =
    controlledToggle ??
    ((nodeId: string) => {
      setInternalExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    });

  // 构建树结构
  const tree = useMemo(() => buildTree(agents), [agents]);

  // 处理仓库选中（点击仓库 = 展开 + 选中）
  const handleSelectRepo = (node: RepoNode) => {
    // 展开仓库
    if (!expanded.has(node.id)) {
      toggleNode(node.id);
    }
    // 获取仓库下所有 agents
    const agentList = node.children.flatMap((ns) =>
      ns.children.map((c) => c.agent),
    );
    onSelectionChange({
      type: "repo",
      id: node.id,
      agents: agentList,
    });
  };

  // 处理命名空间选中
  const handleSelectNamespace = (node: NamespaceNode) => {
    const agentList = node.children.map((c) => c.agent);
    onSelectionChange({
      type: "namespace",
      id: node.id,
      agents: agentList,
    });
  };

  // 处理"全部"选中
  const handleSelectAll = () => {
    onSelectionChange({
      type: "all",
      id: null,
      agents: [],
    });
  };

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("agents.noReposConfigured")}
      </div>
    );
  }

  const totalCount = agents.length;

  return (
    <div className="space-y-1">
      {/* 全部节点 */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          selection.type === "all"
            ? "bg-primary/15 border-l-2 border-primary"
            : "hover:bg-muted",
        )}
        onClick={handleSelectAll}
      >
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            selection.type === "all" && "text-primary",
          )}
        >
          {t("common.all")}
        </span>
        <span className="text-xs text-muted-foreground">{totalCount}</span>
      </div>

      {/* 仓库列表 */}
      {tree.map((repo) => (
        <RepoTreeNode
          key={repo.id}
          node={repo}
          expanded={expanded}
          selection={selection}
          onSelectRepo={handleSelectRepo}
          onSelectNamespace={handleSelectNamespace}
        />
      ))}
    </div>
  );
};

// ========== 子组件 ==========

interface RepoTreeNodeProps {
  node: RepoNode;
  expanded: Set<string>;
  selection: DiscoverySelection;
  onSelectRepo: (node: RepoNode) => void;
  onSelectNamespace: (node: NamespaceNode) => void;
}

const RepoTreeNode: React.FC<RepoTreeNodeProps> = ({
  node,
  expanded,
  selection,
  onSelectRepo,
  onSelectNamespace,
}) => {
  const isExpanded = expanded.has(node.id);
  const isRepoSelected = selection.type === "repo" && selection.id === node.id;

  return (
    <div>
      {/* Repo Header - 点击选中仓库并展开 */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          isRepoSelected
            ? "bg-primary/15 border-l-2 border-primary"
            : "hover:bg-muted",
        )}
        onClick={() => onSelectRepo(node)}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <GitBranch size={14} className="text-blue-500" />
        <span
          className={cn(
            "flex-1 text-sm font-medium truncate",
            isRepoSelected && "text-primary",
          )}
        >
          {node.name}
        </span>
        <span className="text-xs text-muted-foreground">{node.count}</span>
      </div>

      {/* Children - 命名空间列表 */}
      {isExpanded && (
        <div className="ml-4 border-l border-border/50 pl-2">
          {node.children.map((ns) => (
            <NamespaceTreeNode
              key={ns.id}
              node={ns}
              isSelected={
                selection.type === "namespace" && selection.id === ns.id
              }
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
        className={isSelected ? "text-primary" : "text-yellow-500"}
      />
      <span className="flex-1 text-sm truncate">{node.name}</span>
      <span className="text-xs text-muted-foreground">{node.count}</span>
    </div>
  );
};

export default AgentDiscoveryTree;
