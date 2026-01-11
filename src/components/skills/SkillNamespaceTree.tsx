import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  GitBranch,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstalledSkill } from "@/hooks/useSkills";
import type { TreeSelection } from "@/types/tree";
import {
  isAllSelected,
  isRepoSelected,
  isNamespaceSelected,
  createAllSelection,
  createRepoSelection,
  createNamespaceSelection,
} from "@/types/tree";

/** 仓库节点结构 */
interface RepoNode {
  id: string;
  name: string;
  isLocal: boolean;
  namespaces: NamespaceNode[];
  count: number;
}

/** 命名空间节点结构 */
interface NamespaceNode {
  id: string;
  name: string;
  displayName: string;
  count: number;
}

interface SkillNamespaceTreeProps {
  skills: InstalledSkill[];
  /** 当前选中状态 */
  selection: TreeSelection;
  /** 选中状态变化回调 */
  onSelectionChange: (selection: TreeSelection) => void;
}

/**
 * Skill 命名空间树组件
 * 左侧边栏，按 仓库 → 命名空间 的两级结构显示
 * 支持选中仓库节点或命名空间节点
 */
export const SkillNamespaceTree: React.FC<SkillNamespaceTreeProps> = ({
  skills,
  selection,
  onSelectionChange,
}) => {
  const { t } = useTranslation();
  // 手风琴模式：只允许一个仓库展开
  const [expandedRepoId, setExpandedRepoId] = React.useState<string | null>(
    "local", // 默认展开本地
  );

  // 计算总 Skill 数
  const totalCount = skills.length;

  // 构建仓库 → 命名空间树结构
  const repoTree = useMemo(() => {
    if (!skills || skills.length === 0) {
      return [];
    }

    // 按 repo 分组
    const repoMap = new Map<string, Map<string, number>>();

    for (const skill of skills) {
      const repoKey =
        skill.repoOwner && skill.repoName
          ? `${skill.repoOwner}/${skill.repoName}`
          : "local";
      const namespace = skill.namespace || "";

      if (!repoMap.has(repoKey)) {
        repoMap.set(repoKey, new Map());
      }

      const nsMap = repoMap.get(repoKey)!;
      nsMap.set(namespace, (nsMap.get(namespace) || 0) + 1);
    }

    // 构建树结构
    const repos: RepoNode[] = [];

    for (const [repoKey, nsMap] of repoMap) {
      const isLocal = repoKey === "local";
      const namespaceNodes: NamespaceNode[] = [];
      let repoCount = 0;

      // 对命名空间排序：根命名空间放最前面
      const sortedNs = Array.from(nsMap.entries()).sort(([a], [b]) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return a.localeCompare(b);
      });

      for (const [ns, count] of sortedNs) {
        // 命名空间 ID: 组合 repoKey 和 namespace
        const nsId = `${repoKey}/${ns}`;
        namespaceNodes.push({
          id: nsId,
          name: ns,
          displayName: ns || t("skills.rootNamespace", "Root"),
          count,
        });
        repoCount += count;
      }

      repos.push({
        id: repoKey,
        name: isLocal ? t("skills.localSkills", "Local Skills") : repoKey,
        isLocal,
        namespaces: namespaceNodes,
        count: repoCount,
      });
    }

    // 排序：本地放最前面，其他按名称排序
    return repos.sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [skills, t]);

  // 点击仓库：手风琴模式展开/折叠 + 选中
  const handleRepoClick = (repoId: string) => {
    if (expandedRepoId === repoId) {
      // 当前仓库已展开 -> 折叠并选中"全部"
      setExpandedRepoId(null);
      onSelectionChange(createAllSelection());
    } else {
      // 展开新仓库，折叠其他，自动选中该仓库
      setExpandedRepoId(repoId);
      onSelectionChange(createRepoSelection(repoId));
    }
  };

  // 点击命名空间：选中命名空间，确保仓库展开
  const handleNamespaceClick = (repoId: string, nsId: string) => {
    // 确保仓库展开
    setExpandedRepoId(repoId);
    onSelectionChange(createNamespaceSelection(repoId, nsId));
  };

  // 点击"全部"
  const handleAllClick = () => {
    onSelectionChange(createAllSelection());
  };

  return (
    <div className="flex flex-col h-full">
      {/* Namespace List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {/* All Skills */}
        <AllSkillsItem
          count={totalCount}
          isSelected={isAllSelected(selection)}
          onClick={handleAllClick}
        />

        {/* 树形结构 */}
        {repoTree.map((repo) => (
          <RepoTreeItem
            key={repo.id}
            repo={repo}
            isExpanded={expandedRepoId === repo.id}
            isRepoSelected={isRepoSelected(selection, repo.id)}
            selection={selection}
            onRepoClick={() => handleRepoClick(repo.id)}
            onNamespaceClick={(nsId) => handleNamespaceClick(repo.id, nsId)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * "全部技能" 节点
 */
interface AllSkillsItemProps {
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

const AllSkillsItem: React.FC<AllSkillsItemProps> = ({
  count,
  isSelected,
  onClick,
}) => {
  const { t } = useTranslation();
  const Icon = isSelected ? FolderOpen : Folder;

  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
        isSelected
          ? "bg-primary/10 text-primary"
          : "hover:bg-muted text-foreground",
      )}
      onClick={onClick}
    >
      <Icon size={16} className="flex-shrink-0" />
      <span className="flex-1 text-sm truncate">
        {t("skills.allSkills", "All Skills")}
      </span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </div>
  );
};

/**
 * 仓库树节点
 */
interface RepoTreeItemProps {
  repo: RepoNode;
  isExpanded: boolean;
  isRepoSelected: boolean;
  selection: TreeSelection;
  onRepoClick: () => void;
  onNamespaceClick: (nsId: string) => void;
}

const RepoTreeItem: React.FC<RepoTreeItemProps> = ({
  repo,
  isExpanded,
  isRepoSelected: repoSelected,
  selection,
  onRepoClick,
  onNamespaceClick,
}) => {
  const RepoIcon = repo.isLocal ? HardDrive : GitBranch;

  return (
    <div>
      {/* 仓库头部 - 点击时展开 + 选中 */}
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
        <RepoIcon
          size={14}
          className={repo.isLocal ? "text-green-500" : "text-blue-500"}
        />
        <span
          className={cn(
            "flex-1 text-sm font-medium truncate",
            repoSelected && "text-primary",
          )}
        >
          {repo.name}
        </span>
        <span className="text-xs text-muted-foreground">{repo.count}</span>
      </div>

      {/* 命名空间列表 */}
      {isExpanded && (
        <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
          {repo.namespaces.map((ns) => {
            const nsSelected = isNamespaceSelected(selection, ns.id);
            return (
              <div
                key={ns.id}
                className={cn(
                  "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                  nsSelected
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground",
                )}
                onClick={() => onNamespaceClick(ns.id)}
              >
                <Folder
                  size={14}
                  className={nsSelected ? "text-primary" : "text-yellow-500"}
                />
                <span className="flex-1 text-sm truncate">
                  {ns.displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ns.count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SkillNamespaceTree;
