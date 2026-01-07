import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  GitBranch,
  HardDrive,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InstalledAgent, AgentNamespace } from "@/hooks/useAgents";
import { useCreateAgentNamespace, useDeleteAgentNamespace } from "@/hooks/useAgents";
import type { TreeSelection } from "@/types/tree";
import {
  isAllSelected,
  isRepoSelected,
  isNamespaceSelected,
  createAllSelection,
  createRepoSelection,
  createNamespaceSelection,
} from "@/types/tree";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";

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

interface AgentNamespaceTreeProps {
  agents: InstalledAgent[];
  namespaces: AgentNamespace[];
  /** 当前选中状态 */
  selection: TreeSelection;
  /** 选中状态变化回调 */
  onSelectionChange: (selection: TreeSelection) => void;
}

/**
 * Agent 命名空间树组件
 * 左侧边栏，按 仓库 → 命名空间 的两级结构显示
 * 支持选中仓库节点或命名空间节点
 */
export const AgentNamespaceTree: React.FC<AgentNamespaceTreeProps> = ({
  agents,
  namespaces,
  selection,
  onSelectionChange,
}) => {
  const { t } = useTranslation();
  const [expandedRepos, setExpandedRepos] = React.useState<Set<string>>(
    new Set(["local"]), // 默认展开本地
  );
  const [isCreating, setIsCreating] = React.useState(false);
  const [newNamespaceName, setNewNamespaceName] = React.useState("");
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    namespace: string;
    displayName: string;
  } | null>(null);

  const createMutation = useCreateAgentNamespace();
  const deleteMutation = useDeleteAgentNamespace();

  // 计算总 Agent 数
  const totalCount = agents.length;

  // 构建仓库 → 命名空间树结构
  const repoTree = useMemo(() => {
    if (!agents || agents.length === 0) {
      return [];
    }

    // 按 repo 分组
    const repoMap = new Map<string, Map<string, number>>();

    for (const agent of agents) {
      const repoKey =
        agent.repoOwner && agent.repoName
          ? `${agent.repoOwner}/${agent.repoName}`
          : "local";
      const namespace = agent.namespace || "";

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
          displayName: ns || t("agents.rootNamespace", "Root"),
          count,
        });
        repoCount += count;
      }

      repos.push({
        id: repoKey,
        name: isLocal ? t("agents.localAgents", "Local Agents") : repoKey,
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
  }, [agents, t]);

  // 点击仓库：展开 + 选中
  const handleRepoClick = (repoId: string) => {
    // 展开仓库（如果未展开）
    if (!expandedRepos.has(repoId)) {
      setExpandedRepos((prev) => {
        const next = new Set(prev);
        next.add(repoId);
        return next;
      });
    }
    // 选中仓库
    onSelectionChange(createRepoSelection(repoId));
  };

  // 点击命名空间：仅选中（独占）
  const handleNamespaceClick = (repoId: string, nsId: string) => {
    onSelectionChange(createNamespaceSelection(repoId, nsId));
  };

  // 点击"全部"
  const handleAllClick = () => {
    onSelectionChange(createAllSelection());
  };

  // 创建命名空间
  const handleCreate = async () => {
    const name = newNamespaceName.trim();
    if (!name) {
      toast.error(t("agents.namespaceNameRequired"));
      return;
    }

    // 验证命名空间名称格式
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      toast.error(t("agents.namespaceNameInvalid"));
      return;
    }

    try {
      await createMutation.mutateAsync(name);
      toast.success(t("agents.namespaceCreated", { name }), {
        closeButton: true,
      });
      setNewNamespaceName("");
      setIsCreating(false);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  // 删除命名空间
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteMutation.mutateAsync(deleteConfirm.namespace);
      toast.success(
        t("agents.namespaceDeleted", { name: deleteConfirm.displayName }),
        { closeButton: true },
      );
      setDeleteConfirm(null);

      // 如果删除的是当前选中的命名空间，重置选择
      if (
        selection.type === "namespace" &&
        selection.namespaceId?.endsWith(`/${deleteConfirm.namespace}`)
      ) {
        onSelectionChange(createAllSelection());
      }
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t("agents.namespaces")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCreating(true)}
          title={t("agents.createNamespace")}
        >
          <Plus size={14} />
        </Button>
      </div>

      {/* Create Namespace Input */}
      {isCreating && (
        <div className="mb-3 p-2 rounded-lg border border-border bg-muted/50">
          <input
            type="text"
            value={newNamespaceName}
            onChange={(e) => setNewNamespaceName(e.target.value)}
            placeholder={t("agents.newNamespacePlaceholder")}
            className="w-full px-2 py-1 text-sm bg-transparent border-b border-border focus:outline-none focus:border-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <div className="flex justify-end gap-1 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setIsCreating(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {t("common.create")}
            </Button>
          </div>
        </div>
      )}

      {/* Namespace List */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {/* All Agents */}
        <AllAgentsItem
          count={totalCount}
          isSelected={isAllSelected(selection)}
          onClick={handleAllClick}
        />

        {/* 树形结构 */}
        {repoTree.map((repo) => (
          <RepoTreeItem
            key={repo.id}
            repo={repo}
            isExpanded={expandedRepos.has(repo.id)}
            isRepoSelected={isRepoSelected(selection, repo.id)}
            selection={selection}
            namespaces={namespaces}
            onRepoClick={() => handleRepoClick(repo.id)}
            onNamespaceClick={(nsId) => handleNamespaceClick(repo.id, nsId)}
            onDeleteNamespace={(ns, displayName) =>
              setDeleteConfirm({
                isOpen: true,
                namespace: ns,
                displayName,
              })
            }
          />
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={t("agents.deleteNamespace")}
          message={t("agents.deleteNamespaceConfirm", {
            name: deleteConfirm.displayName,
          })}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

/**
 * "全部代理" 节点
 */
interface AllAgentsItemProps {
  count: number;
  isSelected: boolean;
  onClick: () => void;
}

const AllAgentsItem: React.FC<AllAgentsItemProps> = ({
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
        {t("agents.allAgents", "All Agents")}
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
  namespaces: AgentNamespace[];
  onRepoClick: () => void;
  onNamespaceClick: (nsId: string) => void;
  onDeleteNamespace: (namespace: string, displayName: string) => void;
}

const RepoTreeItem: React.FC<RepoTreeItemProps> = ({
  repo,
  isExpanded,
  isRepoSelected: repoSelected,
  selection,
  namespaces,
  onRepoClick,
  onNamespaceClick,
  onDeleteNamespace,
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
            // 查找是否可删除（空的本地命名空间）
            const nsInfo = namespaces.find((n) => n.name === ns.name);
            const canDelete =
              repo.isLocal && nsInfo && nsInfo.agentCount === 0 && ns.name !== "";

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
                <span className="flex-1 text-sm truncate">{ns.displayName}</span>
                <span className="text-xs text-muted-foreground">{ns.count}</span>

                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-red-500"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNamespace(ns.name, ns.displayName);
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentNamespaceTree;
