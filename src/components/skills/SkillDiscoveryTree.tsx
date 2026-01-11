import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, GitBranch, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiscoverableSkill } from "@/lib/api/skills";
import type { TreeSelection } from "@/types/tree";
import {
  isAllSelected,
  isRepoSelected,
  isNamespaceSelected,
  createAllSelection,
  createRepoSelection,
  createNamespaceSelection,
} from "@/types/tree";

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
  /** 该仓库下的所有技能 */
  allSkills: DiscoverableSkill[];
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
    const allSkills: DiscoverableSkill[] = [];

    // 对命名空间排序：(root) 放最前面，其他按字母排序
    const sortedNamespaces = Array.from(namespaceMap.entries()).sort(
      ([a], [b]) => {
        if (a === ROOT_NAMESPACE) return -1;
        if (b === ROOT_NAMESPACE) return 1;
        return a.localeCompare(b);
      },
    );

    for (const [namespace, nsSkills] of sortedNamespaces) {
      const sortedSkills = nsSkills.sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      namespaces.push({
        id: `${repoKey}/${namespace}`,
        name: namespace === ROOT_NAMESPACE ? "skills" : namespace,
        type: "namespace",
        namespace,
        count: nsSkills.length,
        skills: sortedSkills,
      });

      repoCount += nsSkills.length;
      allSkills.push(...sortedSkills);
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
      allSkills,
    });
  }

  // 按仓库名排序
  return repos.sort((a, b) => a.name.localeCompare(b.name));
}

// ========== 组件 Props ==========

interface SkillDiscoveryTreeProps {
  skills: DiscoverableSkill[];
  /** 当前选中状态 */
  selection: TreeSelection;
  /** 选中状态变化回调 */
  onSelectionChange: (
    selection: TreeSelection,
    skills: DiscoverableSkill[],
  ) => void;
  /** 手风琴模式：当前展开的仓库 ID（只能展开一个） */
  expandedRepoId?: string | null;
  /** 展开状态变化回调 */
  onExpandedChange?: (repoId: string | null) => void;
}

/**
 * 技能发现树组件
 * 以 repo → namespace 的层级结构展示
 * 支持选中仓库节点或命名空间节点
 */
export const SkillDiscoveryTree: React.FC<SkillDiscoveryTreeProps> = ({
  skills,
  selection,
  onSelectionChange,
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
  const tree = useMemo(() => buildTree(skills), [skills]);

  // 计算总数
  const totalCount = skills.length;

  // 点击仓库：手风琴模式（展开 + 选中，再点击折叠）
  const handleRepoClick = (repo: RepoNode) => {
    if (expandedRepoId === repo.id) {
      // 当前仓库已展开 -> 折叠并选中"全部"
      setExpandedRepoId(null);
      onSelectionChange(createAllSelection(), skills);
    } else {
      // 展开新仓库，折叠其他（手风琴模式），选中该仓库
      setExpandedRepoId(repo.id);
      onSelectionChange(createRepoSelection(repo.id), repo.allSkills);
    }
  };

  // 点击命名空间：选中（确保仓库展开）
  const handleNamespaceClick = (repoId: string, ns: NamespaceNode) => {
    // 确保仓库展开
    setExpandedRepoId(repoId);
    onSelectionChange(createNamespaceSelection(repoId, ns.id), ns.skills);
  };

  // 点击"全部"
  const handleSelectAll = () => {
    onSelectionChange(createAllSelection(), skills);
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
          isAllSelected(selection)
            ? "bg-primary/10 text-primary font-medium"
            : "hover:bg-muted",
        )}
        onClick={handleSelectAll}
      >
        <Folder
          size={14}
          className={
            isAllSelected(selection) ? "text-primary" : "text-muted-foreground"
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
          isExpanded={expandedRepoId === repo.id}
          selection={selection}
          onRepoClick={() => handleRepoClick(repo)}
          onNamespaceClick={(ns) => handleNamespaceClick(repo.id, ns)}
        />
      ))}
    </div>
  );
};

// ========== 子组件 ==========

interface RepoTreeNodeProps {
  node: RepoNode;
  isExpanded: boolean;
  selection: TreeSelection;
  onRepoClick: () => void;
  onNamespaceClick: (ns: NamespaceNode) => void;
}

const RepoTreeNode: React.FC<RepoTreeNodeProps> = ({
  node,
  isExpanded,
  selection,
  onRepoClick,
  onNamespaceClick,
}) => {
  const repoSelected = isRepoSelected(selection, node.id);

  return (
    <div>
      {/* Repo Header - 点击时展开 + 选中 */}
      <div
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
          repoSelected
            ? "bg-primary/15 border-l-2 border-primary"
            : "hover:bg-muted",
        )}
        onClick={onRepoClick}
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
            repoSelected && "text-primary",
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
              isSelected={isNamespaceSelected(selection, ns.id)}
              onSelect={() => onNamespaceClick(ns)}
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
