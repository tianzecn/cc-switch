import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, GitBranch, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoverableSkill } from "@/lib/api/skills";

// ========== 类型定义 ==========

/** 树节点类型 */
type TreeNodeType = "repo" | "namespace";

/** 树节点基础结构 */
interface TreeNode {
  id: string;
  name: string;
  type: TreeNodeType;
  count: number;
  children?: TreeNode[];
}

/** 仓库节点（顶层） */
interface RepoNode extends TreeNode {
  type: "repo";
  owner: string;
  repoName: string;
  branch: string;
  children: NamespaceNode[];
}

/** 命名空间节点 */
interface NamespaceNode extends TreeNode {
  type: "namespace";
  namespace: string;
  skills: DiscoverableSkill[];
}

// ========== 工具函数 ==========

/** 根命名空间的内部标识 */
const ROOT_NAMESPACE = "(root)";

/**
 * 获取命名空间（使用后端提供的 namespace 字段）
 * 空字符串表示根目录，转换为内部标识 "(root)"
 */
function getNamespace(skill: DiscoverableSkill): string {
  return skill.namespace === "" ? ROOT_NAMESPACE : skill.namespace;
}

/**
 * 将扁平的 DiscoverableSkill 列表转换为树形结构
 */
function buildTree(skills: DiscoverableSkill[]): RepoNode[] {
  // 按 repo → namespace 分组
  const repoMap = new Map<string, Map<string, DiscoverableSkill[]>>();

  for (const skill of skills) {
    const repoKey = `${skill.repoOwner}/${skill.repoName}`;
    const namespace = getNamespace(skill);

    if (!repoMap.has(repoKey)) {
      repoMap.set(repoKey, new Map());
    }

    const namespaceMap = repoMap.get(repoKey)!;
    if (!namespaceMap.has(namespace)) {
      namespaceMap.set(namespace, []);
    }

    namespaceMap.get(namespace)!.push(skill);
  }

  // 构建树结构
  const repos: RepoNode[] = [];

  for (const [repoKey, namespaceMap] of repoMap) {
    const [owner, repoName] = repoKey.split("/");
    const firstSkill = namespaceMap.values().next().value?.[0];
    const branch = firstSkill?.repoBranch || "main";

    const namespaces: NamespaceNode[] = [];
    let repoCount = 0;

    // 对命名空间排序：(root) 放最前面，其他按字母排序
    const sortedNamespaces = Array.from(namespaceMap.entries()).sort(
      ([a], [b]) => {
        if (a === ROOT_NAMESPACE) return -1;
        if (b === ROOT_NAMESPACE) return 1;
        return a.localeCompare(b);
      },
    );

    for (const [namespace, nsSkills] of sortedNamespaces) {
      namespaces.push({
        id: `${repoKey}/${namespace}`,
        name: namespace === ROOT_NAMESPACE ? "skills" : namespace,
        type: "namespace",
        namespace,
        count: nsSkills.length,
        skills: nsSkills.sort((a, b) => a.name.localeCompare(b.name)),
      });

      repoCount += nsSkills.length;
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

interface SkillDiscoveryTreeProps {
  skills: DiscoverableSkill[];
  /** 选中的命名空间 ID（格式: owner/repo/namespace） */
  selectedNamespace: string | null;
  /** 命名空间被选中时的回调 */
  onSelectNamespace: (
    namespaceId: string | null,
    skills: DiscoverableSkill[],
  ) => void;
  expandedNodes?: Set<string>;
  onToggleNode?: (nodeId: string) => void;
}

/**
 * 技能发现树组件
 * 以 repo → namespace 的层级结构展示，点击命名空间在右侧显示技能列表
 */
export const SkillDiscoveryTree: React.FC<SkillDiscoveryTreeProps> = ({
  skills,
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
  const tree = useMemo(() => buildTree(skills), [skills]);

  // 计算总数
  const totalCount = skills.length;

  // 处理命名空间选中
  const handleSelectNamespace = (node: NamespaceNode) => {
    onSelectNamespace(node.id, node.skills);
  };

  // 处理"全部"选中
  const handleSelectAll = () => {
    onSelectNamespace(null, skills);
  };

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        {t("skills.noReposConfigured", "No repositories configured")}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* 全部技能 */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          selectedNamespace === null
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted",
        )}
        onClick={handleSelectAll}
      >
        <Folder
          size={14}
          className={
            selectedNamespace === null
              ? "text-primary"
              : "text-muted-foreground"
          }
        />
        <span className="flex-1 text-sm">
          {t("skills.allSkills", "All Skills")}
        </span>
        <span className="text-xs text-muted-foreground">{totalCount}</span>
      </div>

      {/* 仓库树 */}
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

export default SkillDiscoveryTree;
