import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, GitBranch, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoverableCommand } from "@/hooks/useCommands";

// ========== 类型定义 ==========

/** 树节点类型 */
type TreeNodeType = "repo" | "namespace" | "command";

/** 树节点基础结构 */
interface TreeNode {
  id: string;
  name: string;
  type: TreeNodeType;
  count: number;
  children?: TreeNode[];
  command?: DiscoverableCommand;
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
  children: CommandNode[];
}

/** 命令节点（叶子节点） */
interface CommandNode extends TreeNode {
  type: "command";
  command: DiscoverableCommand;
}

// ========== 工具函数 ==========

/**
 * 将扁平的 DiscoverableCommand 列表转换为树形结构
 */
function buildTree(commands: DiscoverableCommand[]): RepoNode[] {
  // 按 repo 分组
  const repoMap = new Map<string, Map<string, DiscoverableCommand[]>>();

  for (const cmd of commands) {
    const repoKey = `${cmd.repoOwner}/${cmd.repoName}`;
    const namespace = cmd.namespace || "(root)";

    if (!repoMap.has(repoKey)) {
      repoMap.set(repoKey, new Map());
    }

    const namespaceMap = repoMap.get(repoKey)!;
    if (!namespaceMap.has(namespace)) {
      namespaceMap.set(namespace, []);
    }

    namespaceMap.get(namespace)!.push(cmd);
  }

  // 构建树结构
  const repos: RepoNode[] = [];

  for (const [repoKey, namespaceMap] of repoMap) {
    const [owner, repoName] = repoKey.split("/");
    const firstCmd = namespaceMap.values().next().value?.[0];
    const branch = firstCmd?.repoBranch || "main";

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

    for (const [namespace, cmds] of sortedNamespaces) {
      const commandNodes: CommandNode[] = cmds
        .sort((a, b) => a.filename.localeCompare(b.filename))
        .map((cmd) => ({
          id: cmd.key,
          name: cmd.filename,
          type: "command" as const,
          count: 0,
          command: cmd,
        }));

      namespaces.push({
        id: `${repoKey}/${namespace}`,
        name: namespace === "(root)" ? "commands" : namespace,
        type: "namespace",
        namespace,
        count: cmds.length,
        children: commandNodes,
      });

      repoCount += cmds.length;
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

interface CommandDiscoveryTreeProps {
  commands: DiscoverableCommand[];
  /** 选中的命名空间 ID（格式: owner/repo/namespace） */
  selectedNamespace: string | null;
  /** 命名空间被选中时的回调 */
  onSelectNamespace: (
    namespaceId: string,
    commands: DiscoverableCommand[],
  ) => void;
  expandedNodes?: Set<string>;
  onToggleNode?: (nodeId: string) => void;
}

/**
 * 命令发现树组件
 * 以 repo → namespace 的层级结构展示，点击命名空间在右侧显示命令列表
 */
export const CommandDiscoveryTree: React.FC<CommandDiscoveryTreeProps> = ({
  commands,
  selectedNamespace,
  onSelectNamespace,
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
  const tree = useMemo(() => buildTree(commands), [commands]);

  // 处理命名空间选中
  const handleSelectNamespace = (node: NamespaceNode) => {
    const cmds = node.children.map((c) => c.command);
    onSelectNamespace(node.id, cmds);
  };

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("commands.noReposConfigured")}
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

export default CommandDiscoveryTree;
