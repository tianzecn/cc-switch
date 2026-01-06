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
  name: string;
  displayName: string;
  count: number;
}

interface SkillNamespaceTreeProps {
  skills: InstalledSkill[];
  selectedNamespace: string | null;
  onSelectNamespace: (namespace: string | null) => void;
}

/**
 * Skill 命名空间树组件
 * 左侧边栏，按 仓库 → 命名空间 的两级结构显示
 */
export const SkillNamespaceTree: React.FC<SkillNamespaceTreeProps> = ({
  skills,
  selectedNamespace,
  onSelectNamespace,
}) => {
  const { t } = useTranslation();
  const [expandedRepos, setExpandedRepos] = React.useState<Set<string>>(
    new Set(["local"]), // 默认展开本地
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
        namespaceNodes.push({
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

  const toggleRepo = (repoId: string) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) {
        next.delete(repoId);
      } else {
        next.add(repoId);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("skills.namespaces", "Namespaces")}
        </h3>
      </div>

      {/* Namespace List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {/* All Skills */}
        <NamespaceItem
          name={null}
          displayName={t("skills.allSkills", "All Skills")}
          count={totalCount}
          isSelected={selectedNamespace === null}
          onClick={() => onSelectNamespace(null)}
        />

        {/* 树形结构 */}
        {repoTree.map((repo) => (
          <RepoTreeItem
            key={repo.id}
            repo={repo}
            isExpanded={expandedRepos.has(repo.id)}
            onToggle={() => toggleRepo(repo.id)}
            selectedNamespace={selectedNamespace}
            onSelectNamespace={onSelectNamespace}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * 命名空间列表项
 */
interface NamespaceItemProps {
  name: string | null;
  displayName: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

const NamespaceItem: React.FC<NamespaceItemProps> = ({
  name: _name,
  displayName,
  count,
  isSelected,
  onClick,
}) => {
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
      <span className="flex-1 text-sm truncate">{displayName}</span>
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
  onToggle: () => void;
  selectedNamespace: string | null;
  onSelectNamespace: (namespace: string | null) => void;
}

const RepoTreeItem: React.FC<RepoTreeItemProps> = ({
  repo,
  isExpanded,
  onToggle,
  selectedNamespace,
  onSelectNamespace,
}) => {
  const RepoIcon = repo.isLocal ? HardDrive : GitBranch;

  return (
    <div>
      {/* 仓库头部 */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted transition-colors"
        onClick={onToggle}
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
        <span className="flex-1 text-sm font-medium truncate">{repo.name}</span>
        <span className="text-xs text-muted-foreground">{repo.count}</span>
      </div>

      {/* 命名空间列表 */}
      {isExpanded && (
        <div className="ml-4 border-l border-border/50 pl-2 space-y-0.5">
          {repo.namespaces.map((ns) => (
            <div
              key={ns.name}
              className={cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors",
                selectedNamespace === ns.name
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground",
              )}
              onClick={() => onSelectNamespace(ns.name)}
            >
              <Folder
                size={14}
                className={
                  selectedNamespace === ns.name
                    ? "text-primary"
                    : "text-yellow-500"
                }
              />
              <span className="flex-1 text-sm truncate">{ns.displayName}</span>
              <span className="text-xs text-muted-foreground">{ns.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SkillNamespaceTree;
