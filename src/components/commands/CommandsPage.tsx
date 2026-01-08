import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, Download, RefreshCw, FileUp, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useInstalledCommands,
  useCommandNamespaces,
  useRefreshFromSsot,
  useToggleCommandApp,
  useUninstallCommand,
  useUninstallCommandsBatch,
  useOpenCommandInEditor,
  useAppCommandsSupport,
  type InstalledCommand,
  type AppType,
} from "@/hooks/useCommands";
import {
  useCheckCommandsUpdates,
  useUpdateCommandsBatch,
  useUpdatableResourceIds,
} from "@/hooks/useResourceUpdates";
import { CheckUpdatesButton, UpdateNotificationBar } from "@/components/updates";
import { CommandNamespaceTree } from "./CommandNamespaceTree";
import { GroupedCommandsList } from "./GroupedCommandsList";
import { CommandDetailPanel } from "./CommandDetailPanel";
import { CommandDiscovery } from "./CommandDiscovery";
import { CommandImport } from "./CommandImport";
import { ConflictDetectionPanel } from "./ConflictDetectionPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import type { TreeSelection } from "@/types/tree";
import { createAllSelection } from "@/types/tree";

type ViewMode = "list" | "discovery" | "import";

/**
 * Commands 管理主页面
 * v3.11.0+ 统一管理架构：树形导航 + 分组列表
 */
export const CommandsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // 树选中状态（使用 TreeSelection 类型）
  const [listSelection, setListSelection] = useState<TreeSelection>(
    createAllSelection(),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommand, setSelectedCommand] = useState<InstalledCommand | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Queries
  const { data: commands = [], isLoading } = useInstalledCommands();
  const { data: namespaces = [] } = useCommandNamespaces();
  const refreshMutation = useRefreshFromSsot();
  const toggleAppMutation = useToggleCommandApp();
  const uninstallMutation = useUninstallCommand();
  const uninstallBatchMutation = useUninstallCommandsBatch();
  const openEditorMutation = useOpenCommandInEditor();

  // 检查各应用的 Commands 支持状态
  const { data: claudeSupported = true } = useAppCommandsSupport("claude");
  const { data: codexSupported = false } = useAppCommandsSupport("codex");
  const { data: geminiSupported = false } = useAppCommandsSupport("gemini");

  // 更新检测
  const {
    data: updateCheckResult,
    isLoading: isCheckingUpdates,
    isFetching: isFetchingUpdates,
    refetch: checkUpdates,
  } = useCheckCommandsUpdates();
  const [updatesDismissed, setUpdatesDismissed] = useState(false);
  const updateBatchMutation = useUpdateCommandsBatch();
  const updatableIds = useUpdatableResourceIds(updateCheckResult);

  const appSupport = useMemo(
    () => ({
      claude: claudeSupported,
      codex: codexSupported,
      gemini: geminiSupported,
    }),
    [claudeSupported, codexSupported, geminiSupported],
  );

  // 统计各应用启用数量
  const enabledCounts = useMemo(() => {
    const counts = { claude: 0, codex: 0, gemini: 0, total: 0 };
    counts.total = commands.length;
    commands.forEach((cmd) => {
      if (cmd.apps.claude) counts.claude++;
      if (cmd.apps.codex) counts.codex++;
      if (cmd.apps.gemini) counts.gemini++;
    });
    return counts;
  }, [commands]);

  // 根据 TreeSelection 计算仓库 key
  const getRepoKey = useCallback((cmd: InstalledCommand): string => {
    return cmd.repoOwner && cmd.repoName
      ? `${cmd.repoOwner}/${cmd.repoName}`
      : "local";
  }, []);

  // 根据 TreeSelection 计算命名空间 ID
  const getNamespaceId = useCallback(
    (cmd: InstalledCommand): string => {
      const repoKey = getRepoKey(cmd);
      return `${repoKey}/${cmd.namespace || ""}`;
    },
    [getRepoKey],
  );

  // 按树选中状态和搜索过滤 Commands
  const filteredCommands = useMemo(() => {
    let result = commands;

    // 按树选中状态过滤
    if (listSelection.type === "repo" && listSelection.repoId) {
      result = result.filter((c) => getRepoKey(c) === listSelection.repoId);
    } else if (listSelection.type === "namespace" && listSelection.namespaceId) {
      result = result.filter((c) => getNamespaceId(c) === listSelection.namespaceId);
    }
    // type === "all" 时不过滤

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query) ||
          (c.description?.toLowerCase().includes(query) ?? false),
      );
    }

    return result;
  }, [commands, listSelection, searchQuery, getRepoKey, getNamespaceId]);

  // 计算空状态类型
  const emptyStateType = useMemo((): "all" | "repo" | "namespace" | "search" => {
    if (searchQuery.trim()) return "search";
    if (listSelection.type === "namespace") return "namespace";
    if (listSelection.type === "repo") return "repo";
    return "all";
  }, [searchQuery, listSelection]);

  // 搜索处理：输入时自动切换到"全部"视图
  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (value.trim() && listSelection.type !== "all") {
        setListSelection(createAllSelection());
      }
    },
    [listSelection],
  );

  const handleRefresh = async () => {
    try {
      const count = await refreshMutation.mutateAsync();
      toast.success(t("commands.refreshSuccess", { count }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleCheckUpdates = useCallback(async () => {
    setUpdatesDismissed(false);
    try {
      if (commands.length === 0) {
        toast.info(t("updates.noSkillsToCheck"));
        return;
      }

      // 显示检查范围提示
      toast.info(t("updates.checkingRange", { count: commands.length }));

      const result = await checkUpdates();
      if (result.data?.updateCount === 0) {
        toast.success(t("updates.noUpdates"));
      }
    } catch (error) {
      toast.error(t("updates.error.checkFailed"), {
        description: String(error),
      });
    }
  }, [checkUpdates, commands.length, t]);

  const handleUpdateAll = useCallback(async () => {
    if (updatableIds.length === 0) return;

    try {
      const result = await updateBatchMutation.mutateAsync(updatableIds);
      if (result.successCount > 0) {
        toast.success(t("updates.updateSuccess", { count: result.successCount }));
        setUpdatesDismissed(true);
      }
      if (result.failedCount > 0) {
        toast.error(t("updates.updatePartialFailed", { count: result.failedCount }));
      }
    } catch (error) {
      toast.error(t("updates.error.updateFailed"), {
        description: String(error),
      });
    }
  }, [updatableIds, updateBatchMutation, t]);

  const handleToggleApp = async (id: string, app: AppType, enabled: boolean) => {
    try {
      await toggleAppMutation.mutateAsync({ id, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleUninstall = (commandId: string) => {
    const command = commands.find((c) => c.id === commandId);
    if (!command) return;

    setConfirmDialog({
      isOpen: true,
      title: t("commands.uninstall"),
      message: t("commands.uninstallConfirm", { name: command.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(commandId);
          setConfirmDialog(null);
          if (selectedCommand?.id === commandId) {
            setSelectedCommand(null);
          }
          toast.success(t("commands.uninstallSuccess", { name: command.name }), {
            closeButton: true,
          });
        } catch (error) {
          toast.error(t("common.error"), {
            description: String(error),
          });
        }
      },
    });
  };

  const handleOpenEditor = async (commandId: string) => {
    try {
      await openEditorMutation.mutateAsync(commandId);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleUninstallAll = () => {
    if (filteredCommands.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: t("commands.uninstallAll"),
      message: t("commands.uninstallAllConfirm", { count: filteredCommands.length }),
      onConfirm: async () => {
        try {
          const ids = filteredCommands.map((c) => c.id);
          const count = await uninstallBatchMutation.mutateAsync(ids);
          setConfirmDialog(null);
          setSelectedCommand(null);
          toast.success(t("commands.uninstallAllSuccess", { count }), {
            closeButton: true,
          });
        } catch (error) {
          toast.error(t("common.error"), {
            description: String(error),
          });
        }
      },
    });
  };

  if (viewMode === "discovery") {
    return <CommandDiscovery onBack={() => setViewMode("list")} />;
  }

  if (viewMode === "import") {
    return <CommandImport onBack={() => setViewMode("list")} />;
  }

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Terminal size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("commands.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("commands.subtitle")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder={t("commands.searchPlaceholder", "Search commands...")}
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-48"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleUninstallAll}
            disabled={filteredCommands.length === 0 || uninstallBatchMutation.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 size={16} />
            <span className="ml-2">{t("commands.uninstallAll")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              size={16}
              className={refreshMutation.isPending ? "animate-spin" : ""}
            />
            <span className="ml-2">{t("commands.refresh")}</span>
          </Button>
          <CheckUpdatesButton
            isChecking={isCheckingUpdates || isFetchingUpdates}
            onCheck={handleCheckUpdates}
            result={updateCheckResult}
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("import")}
          >
            <FileUp size={16} />
            <span className="ml-2">{t("commands.import")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("discovery")}
          >
            <Download size={16} />
            <span className="ml-2">{t("commands.discover")}</span>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("commands.installed", { count: enabledCounts.total })} ·{" "}
          {t("commands.apps.claude")}: {enabledCounts.claude} ·{" "}
          {t("commands.apps.codex")}: {enabledCounts.codex} ·{" "}
          {t("commands.apps.gemini")}: {enabledCounts.gemini}
        </div>
      </div>

      {/* Conflict Detection Panel */}
      <ConflictDetectionPanel className="flex-shrink-0 mb-4" />

      {/* Update Notification Bar */}
      {updateCheckResult && !updatesDismissed && (updateCheckResult.updateCount > 0 || updateCheckResult.deletedCount > 0) && (
        <div className="flex-shrink-0 mb-4">
          <UpdateNotificationBar
            result={updateCheckResult}
            resourceLabel={t("commands.title")}
            onDismiss={() => setUpdatesDismissed(true)}
            onUpdateAll={handleUpdateAll}
            isUpdating={updateBatchMutation.isPending}
          />
        </div>
      )}

      {/* Main Content - Three Column Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-8">
        {/* Left Sidebar - Namespace Tree */}
        <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
          <CommandNamespaceTree
            commands={commands}
            namespaces={namespaces}
            selection={listSelection}
            onSelectionChange={setListSelection}
          />
        </div>

        {/* Middle - Commands List */}
        <div className="flex-1 overflow-y-auto">
          <GroupedCommandsList
            commands={filteredCommands}
            selection={listSelection}
            selectedCommandId={selectedCommand?.id ?? null}
            onSelectCommand={setSelectedCommand}
            onToggleApp={handleToggleApp}
            onUninstall={handleUninstall}
            onOpenEditor={handleOpenEditor}
            appSupport={appSupport}
            isLoading={isLoading}
            emptyStateType={emptyStateType}
            updateCheckResult={updateCheckResult}
          />
        </div>

        {/* Right Sidebar - Detail Panel */}
        {selectedCommand && (
          <div className="w-80 flex-shrink-0">
            <CommandDetailPanel
              command={selectedCommand}
              onClose={() => setSelectedCommand(null)}
              onOpenEditor={() => handleOpenEditor(selectedCommand.id)}
            />
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default CommandsPage;
