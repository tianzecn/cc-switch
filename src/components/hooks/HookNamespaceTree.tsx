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
import { Input } from "@/components/ui/input";
import {
  useCreateHookNamespace,
  useDeleteHookNamespace,
  type HookNamespace,
  type InstalledHook,
} from "@/hooks/useHooks";
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

interface HookNamespaceTreeProps {
  namespaces: HookNamespace[];
  hooks?: InstalledHook[];
  selectedNamespace: string | null;
  onSelectNamespace: (namespace: string | null) => void;
}

/**
 * Hook 命名空间树组件
 * 左侧边栏，按 仓库 → 命名空间 的两级结构显示
 */
export const HookNamespaceTree: React.FC<HookNamespaceTreeProps> = ({
  namespaces,
  hooks = [],
  selectedNamespace,
  onSelectNamespace,
}) => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = React.useState(false);
  const [newNamespaceName, setNewNamespaceName] = React.useState("");
  // 手风琴模式：只允许一个仓库展开
  const [expandedRepoId, setExpandedRepoId] = React.useState<string | null>(
    "local", // 默认展开本地
  );
  const [deleteConfirm, setDeleteConfirm] = React.useState<{
    isOpen: boolean;
    namespace: string;
    displayName: string;
  } | null>(null);

  const createMutation = useCreateHookNamespace();
  const deleteMutation = useDeleteHookNamespace();

  // 计算总 Hook 数
  const totalCount = React.useMemo(() => {
    return namespaces.reduce((sum, ns) => sum + ns.hookCount, 0);
  }, [namespaces]);

  // 构建仓库 → 命名空间树结构
  const repoTree = useMemo(() => {
    if (!hooks || hooks.length === 0) {
      return null;
    }

    const repoMap = new Map<string, Map<string, number>>();

    for (const hook of hooks) {
      const repoKey =
        hook.repoOwner && hook.repoName
          ? `${hook.repoOwner}/${hook.repoName}`
          : "local";
      const namespace = hook.namespace || "";

      if (!repoMap.has(repoKey)) {
        repoMap.set(repoKey, new Map());
      }

      const nsMap = repoMap.get(repoKey)!;
      nsMap.set(namespace, (nsMap.get(namespace) || 0) + 1);
    }

    const repos: RepoNode[] = [];

    for (const [repoKey, nsMap] of repoMap) {
      const isLocal = repoKey === "local";
      const namespaceNodes: NamespaceNode[] = [];
      let repoCount = 0;

      const sortedNs = Array.from(nsMap.entries()).sort(([a], [b]) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return a.localeCompare(b);
      });

      for (const [ns, count] of sortedNs) {
        namespaceNodes.push({
          name: ns,
          displayName: ns || t("hooks.rootNamespace"),
          count,
        });
        repoCount += count;
      }

      repos.push({
        id: repoKey,
        name: isLocal ? t("hooks.localHooks") : repoKey,
        isLocal,
        namespaces: namespaceNodes,
        count: repoCount,
      });
    }

    return repos.sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [hooks, t]);

  // 手风琴模式：切换仓库展开状态
  const toggleRepo = (repoId: string) => {
    if (expandedRepoId === repoId) {
      // 当前仓库已展开 -> 折叠
      setExpandedRepoId(null);
    } else {
      // 展开新仓库，折叠其他
      setExpandedRepoId(repoId);
    }
  };

  const handleCreate = async () => {
    const name = newNamespaceName.trim();
    if (!name) return;

    // 验证命名空间名称
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      toast.error(t("hooks.invalidNamespaceName"));
      return;
    }

    try {
      await createMutation.mutateAsync(name);
      setNewNamespaceName("");
      setIsCreating(false);
      toast.success(t("hooks.namespaceCreated", { name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleDelete = async (namespace: string) => {
    try {
      await deleteMutation.mutateAsync(namespace);
      setDeleteConfirm(null);
      toast.success(t("hooks.namespaceDeleted"), { closeButton: true });
      if (selectedNamespace === namespace) {
        onSelectNamespace(null);
      }
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  return (
    <div className="h-full flex flex-col glass rounded-xl border border-white/10">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-sm font-medium text-foreground">
          {t("hooks.namespaces")}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setIsCreating(true)}
          title={t("hooks.createNamespace")}
        >
          <Plus size={14} />
        </Button>
      </div>

      {/* New Namespace Input */}
      {isCreating && (
        <div className="px-3 py-2 border-b border-white/5">
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder={t("hooks.namespaceName")}
              value={newNamespaceName}
              onChange={(e) => setNewNamespaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewNamespaceName("");
                }
              }}
              className="h-7 text-sm"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!newNamespaceName.trim() || createMutation.isPending}
              className="h-7 px-2"
            >
              {createMutation.isPending ? "..." : t("common.confirm")}
            </Button>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* All Hooks */}
        <TreeItem
          icon={<FolderOpen size={14} />}
          label={t("hooks.allHooks")}
          count={totalCount}
          selected={selectedNamespace === null}
          onClick={() => onSelectNamespace(null)}
          depth={0}
        />

        {/* Repo Tree */}
        {repoTree &&
          repoTree.map((repo) => (
            <div key={repo.id}>
              {/* Repo Node */}
              <TreeItem
                icon={
                  repo.isLocal ? (
                    <HardDrive size={14} />
                  ) : (
                    <GitBranch size={14} />
                  )
                }
                label={repo.name}
                count={repo.count}
                expanded={expandedRepoId === repo.id}
                onClick={() => toggleRepo(repo.id)}
                depth={0}
                expandable
              />

              {/* Namespace Nodes */}
              {expandedRepoId === repo.id &&
                repo.namespaces.map((ns) => (
                  <TreeItem
                    key={`${repo.id}/${ns.name}`}
                    icon={
                      selectedNamespace === ns.name ? (
                        <FolderOpen size={14} />
                      ) : (
                        <Folder size={14} />
                      )
                    }
                    label={ns.displayName}
                    count={ns.count}
                    selected={selectedNamespace === ns.name}
                    onClick={() => onSelectNamespace(ns.name)}
                    depth={1}
                    onDelete={
                      ns.name && ns.count === 0
                        ? () =>
                            setDeleteConfirm({
                              isOpen: true,
                              namespace: ns.name,
                              displayName: ns.displayName,
                            })
                        : undefined
                    }
                  />
                ))}
            </div>
          ))}
      </div>

      {/* Delete Confirm Dialog */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          title={t("hooks.deleteNamespace")}
          message={t("hooks.deleteNamespaceConfirm", {
            name: deleteConfirm.displayName,
          })}
          onConfirm={() => handleDelete(deleteConfirm.namespace)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

/**
 * 树节点组件
 */
interface TreeItemProps {
  icon: React.ReactNode;
  label: string;
  count?: number;
  selected?: boolean;
  expanded?: boolean;
  expandable?: boolean;
  depth: number;
  onClick?: () => void;
  onDelete?: () => void;
}

const TreeItem: React.FC<TreeItemProps> = ({
  icon,
  label,
  count,
  selected,
  expanded,
  expandable,
  depth,
  onClick,
  onDelete,
}) => {
  return (
    <div
      className={cn(
        "group flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors text-sm",
        selected
          ? "bg-primary/10 text-primary"
          : "text-foreground/80 hover:bg-muted",
      )}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={onClick}
    >
      {expandable && (
        <span className="w-4 flex-shrink-0">
          {expanded ? (
            <ChevronDown size={12} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={12} className="text-muted-foreground" />
          )}
        </span>
      )}
      <span className="flex-shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">{count}</span>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
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

export default HookNamespaceTree;
