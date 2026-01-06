import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Folder,
  FolderOpen,
  Plus,
  Trash2,
  ChevronRight,
  ChevronDown,
  GitBranch,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateNamespace,
  useDeleteNamespace,
  type CommandNamespace,
  type InstalledCommand,
} from "@/hooks/useCommands";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface NamespaceTreeProps {
  namespaces: CommandNamespace[];
  commands?: InstalledCommand[];
  selectedNamespace: string | null;
  onSelectNamespace: (namespace: string | null) => void;
}

/**
 * 命名空间树组件
 * 左侧边栏，按 仓库 → 命名空间 的两级结构显示
 */
export const NamespaceTree: React.FC<NamespaceTreeProps> = ({
  namespaces,
  commands = [],
  selectedNamespace,
  onSelectNamespace,
}) => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = React.useState(false);
  const [newNamespaceName, setNewNamespaceName] = React.useState("");
  const [expandedRepos, setExpandedRepos] = React.useState<Set<string>>(
    new Set(["local"]), // 默认展开本地
  );
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    namespace: string;
    displayName: string;
  } | null>(null);

  const createMutation = useCreateNamespace();
  const deleteMutation = useDeleteNamespace();

  // 计算总命令数
  const totalCount = React.useMemo(() => {
    return namespaces.reduce((sum, ns) => sum + ns.commandCount, 0);
  }, [namespaces]);

  // 构建仓库 → 命名空间树结构
  const repoTree = useMemo(() => {
    // 如果没有 commands 数据，使用传统的扁平结构
    if (!commands || commands.length === 0) {
      return null;
    }

    // 按 repo 分组
    const repoMap = new Map<string, Map<string, number>>();

    for (const cmd of commands) {
      const repoKey =
        cmd.repoOwner && cmd.repoName
          ? `${cmd.repoOwner}/${cmd.repoName}`
          : "local";
      const namespace = cmd.namespace || "";

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
          displayName: ns || t("commands.rootNamespace"),
          count,
        });
        repoCount += count;
      }

      repos.push({
        id: repoKey,
        name: isLocal ? t("commands.localCommands") : repoKey,
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
  }, [commands, t]);

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

  const handleCreate = async () => {
    const name = newNamespaceName.trim();
    if (!name) {
      toast.error(t("commands.namespaceNameRequired"));
      return;
    }

    // 验证命名空间名称格式
    if (!/^[a-z][a-z0-9-]*$/.test(name)) {
      toast.error(t("commands.namespaceNameInvalid"));
      return;
    }

    try {
      await createMutation.mutateAsync(name);
      toast.success(t("commands.namespaceCreated", { name }), {
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

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteMutation.mutateAsync(deleteConfirm.namespace);
      toast.success(
        t("commands.namespaceDeleted", { name: deleteConfirm.displayName }),
        { closeButton: true },
      );
      setDeleteConfirm(null);

      // 如果删除的是当前选中的命名空间，重置选择
      if (selectedNamespace === deleteConfirm.namespace) {
        onSelectNamespace(null);
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
          {t("commands.namespaces")}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCreating(true)}
          title={t("commands.createNamespace")}
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
            placeholder={t("commands.newNamespacePlaceholder")}
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
        {/* All Commands */}
        <NamespaceItem
          name={null}
          displayName={t("commands.allCommands")}
          count={totalCount}
          isSelected={selectedNamespace === null}
          onClick={() => onSelectNamespace(null)}
        />

        {/* 树形结构（如果有 commands 数据） */}
        {repoTree
          ? repoTree.map((repo) => (
              <RepoTreeItem
                key={repo.id}
                repo={repo}
                isExpanded={expandedRepos.has(repo.id)}
                onToggle={() => toggleRepo(repo.id)}
                selectedNamespace={selectedNamespace}
                onSelectNamespace={onSelectNamespace}
                namespaces={namespaces}
                onDeleteNamespace={(ns, displayName) =>
                  setDeleteConfirm({
                    isOpen: true,
                    namespace: ns,
                    displayName,
                  })
                }
              />
            ))
          : /* 扁平结构（兼容旧逻辑） */
            namespaces.map((ns) => (
              <NamespaceItem
                key={ns.name}
                name={ns.name}
                displayName={ns.displayName}
                count={ns.commandCount}
                isSelected={selectedNamespace === ns.name}
                onClick={() => onSelectNamespace(ns.name)}
                onDelete={() =>
                  setDeleteConfirm({
                    isOpen: true,
                    namespace: ns.name,
                    displayName: ns.displayName,
                  })
                }
                canDelete={ns.commandCount === 0 && ns.name !== ""}
              />
            ))}
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={t("commands.deleteNamespace")}
          message={t("commands.deleteNamespaceConfirm", {
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
 * 命名空间列表项
 */
interface NamespaceItemProps {
  name: string | null;
  displayName: string;
  count: number;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}

const NamespaceItem: React.FC<NamespaceItemProps> = ({
  name: _name, // Used for identification in parent component
  displayName,
  count,
  isSelected,
  onClick,
  onDelete,
  canDelete,
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

      {canDelete && onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:text-red-500"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 size={12} />
        </Button>
      )}
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
  namespaces: CommandNamespace[];
  onDeleteNamespace: (namespace: string, displayName: string) => void;
}

const RepoTreeItem: React.FC<RepoTreeItemProps> = ({
  repo,
  isExpanded,
  onToggle,
  selectedNamespace,
  onSelectNamespace,
  namespaces,
  onDeleteNamespace,
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
          {repo.namespaces.map((ns) => {
            // 查找是否可删除
            const nsInfo = namespaces.find((n) => n.name === ns.name);
            const canDelete =
              nsInfo && nsInfo.commandCount === 0 && ns.name !== "";

            return (
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
                <span className="flex-1 text-sm truncate">
                  {ns.displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ns.count}
                </span>

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

export default NamespaceTree;
