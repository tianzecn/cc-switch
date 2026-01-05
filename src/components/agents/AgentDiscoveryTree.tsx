import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  ChevronDown,
  GitBranch,
  Folder,
} from "lucide-react";
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
      }
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

interface AgentDiscoveryTreeProps {
  agents: DiscoverableAgent[];
  /** 选中的命名空间 ID（格式: owner/repo/namespace） */
  selectedNamespace: string | null;
  /** 命名空间被选中时的回调 */
  onSelectNamespace: (namespaceId: string, agents: DiscoverableAgent[]) => void;
  expandedNodes?: Set<string>;
  onToggleNode?: (nodeId: string) => void;
}

/**
 * Agent 发现树组件
 * 以 repo → namespace 的层级结构展示，点击命名空间在右侧显示 agent 列表
 */
export const AgentDiscoveryTree: React.FC<AgentDiscoveryTreeProps> = ({
  agents,
  selectedNamespace,
  onSelectNamespace,
  expandedNodes: controlledExpanded,
  onToggleNode: controlledToggle,
}) => {
  const { t } = useTranslation();

  // 内部展开状态（如果没有外部控制）
  const [internalExpanded, setInternalExpanded] = React.useState<Set<string>>(
    new Set()
  );

  const expanded = controlledExpanded ?? internalExpanded;
  const toggleNode = controlledToggle ?? ((nodeId: string) => {
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

  // 处理命名空间选中
  const handleSelectNamespace = (node: NamespaceNode) => {
    const agentList = node.children.map((c) => c.agent);
    onSelectNamespace(node.id, agentList);
  };

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("agents.noReposConfigured")}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((repo) => (
        <RepoTreeNode
          key={repo.id}
          node={repo}
          expanded={expanded}
          toggleNode={toggleNode}
          selectedNamespace={selectedNamespace}
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
  toggleNode: (nodeId: string) => void;
  selectedNamespace: string | null;
  onSelectNamespace: (node: NamespaceNode) => void;
}

const RepoTreeNode: React.FC<RepoTreeNodeProps> = ({
  node,
  expanded,
  toggleNode,
  selectedNamespace,
  onSelectNamespace,
}) => {
  const isExpanded = expanded.has(node.id);

  return (
    <div>
      {/* Repo Header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
        onClick={() => toggleNode(node.id)}
      >
        {isExpanded ? (
          <ChevronDown size={14} className="text-muted-foreground" />
        ) : (
          <ChevronRight size={14} className="text-muted-foreground" />
        )}
        <GitBranch size={14} className="text-blue-500" />
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
          : "hover:bg-muted text-foreground"
      )}
      onClick={onSelect}
    >
      <Folder size={14} className={isSelected ? "text-primary" : "text-yellow-500"} />
      <span className="flex-1 text-sm truncate">{node.name}</span>
      <span className="text-xs text-muted-foreground">{node.count}</span>
    </div>
  );
};

export default AgentDiscoveryTree;
