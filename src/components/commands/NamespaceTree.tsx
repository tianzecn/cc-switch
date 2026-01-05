import React from "react";
import { useTranslation } from "react-i18next";
import { Folder, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCreateNamespace,
  useDeleteNamespace,
  type CommandNamespace,
} from "@/hooks/useCommands";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface NamespaceTreeProps {
  namespaces: CommandNamespace[];
  selectedNamespace: string | null;
  onSelectNamespace: (namespace: string | null) => void;
}

/**
 * 命名空间树组件
 * 左侧边栏，显示所有命名空间及其命令数量
 */
export const NamespaceTree: React.FC<NamespaceTreeProps> = ({
  namespaces,
  selectedNamespace,
  onSelectNamespace,
}) => {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = React.useState(false);
  const [newNamespaceName, setNewNamespaceName] = React.useState("");
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
        { closeButton: true }
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

        {/* Individual Namespaces */}
        {namespaces.map((ns) => (
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
          : "hover:bg-muted text-foreground"
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

export default NamespaceTree;
