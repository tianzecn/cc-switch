import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Terminal,
  Download,
  RefreshCw,
  FileUp,
  Search,
  Trash2,
  Settings,
  Check,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useInstalledCommands,
  useCommandNamespaces,
  useToggleCommandApp,
  useUninstallCommand,
  useUninstallCommandsBatch,
  useChangeCommandScope,
  useOpenCommandInEditor,
  useAppCommandsSupport,
  useDiscoverableCommands,
  useInstallCommand,
  useCommandRepos,
  useAddCommandRepo,
  useRemoveCommandRepo,
  useRestoreBuiltinCommandRepos,
  useRefreshDiscoverableCommands,
  type InstalledCommand,
  type AppType,
  type DiscoverableCommand,
  type CommandRepo,
} from "@/hooks/useCommands";
import { useBatchInstallCommands } from "@/hooks/useBatchInstallCommands";
import { ContentContainer } from "@/components/layout";
import {
  useCheckCommandsUpdates,
  useCheckCommandsUpdatesByIds,
  useUpdateCommandsBatch,
  useUpdatableResourceIds,
  useFixCommandsHash,
  getResourceUpdateStatus,
  type UpdateCheckResult,
} from "@/hooks/useResourceUpdates";
import {
  CheckUpdatesButton,
  UpdateNotificationBar,
  UpdateBadge,
} from "@/components/updates";
import { CommandNamespaceTree } from "./CommandNamespaceTree";
import { GroupedCommandsList } from "./GroupedCommandsList";
import { CommandDetailPanel } from "./CommandDetailPanel";
import { CommandImport } from "./CommandImport";
import { InstallScopeDialog } from "@/components/common/InstallScopeDialog";
import type { InstallScope } from "@/components/common/ScopeBadge";
import { ConflictDetectionPanel } from "./ConflictDetectionPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import type { TreeSelection } from "@/types/tree";
import { createAllSelection } from "@/types/tree";
import { CommandRepoManager } from "./CommandRepoManager";
import {
  CommandDiscoveryTree,
  type DiscoverySelection,
} from "./CommandDiscoveryTree";
import { BatchInstallCommandsButton } from "./BatchInstallCommandsButton";

type ViewMode = "list" | "discovery" | "import";

/**
 * Commands 管理主页面
 * v3.11.0+ 统一管理架构：树形导航 + 分组列表
 */
export const CommandsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // 树选中状态（使用 TreeSelection 类型）
  const [listSelection, setListSelection] =
    useState<TreeSelection>(createAllSelection());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCommand, setSelectedCommand] =
    useState<InstalledCommand | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // === Discovery 模式状态 ===
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [discoveryExpandedNodes, setDiscoveryExpandedNodes] = useState<
    Set<string>
  >(new Set());
  const [discoverySelection, setDiscoverySelection] =
    useState<DiscoverySelection>({
      type: "all",
      id: null,
      commands: [],
    });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Queries
  const { data: commands = [], isLoading } = useInstalledCommands();
  const { data: namespaces = [] } = useCommandNamespaces();
  const toggleAppMutation = useToggleCommandApp();
  const uninstallMutation = useUninstallCommand();
  const uninstallBatchMutation = useUninstallCommandsBatch();
  const openEditorMutation = useOpenCommandInEditor();
  const changeScopeMutation = useChangeCommandScope();

  // === Discovery 模式 Queries ===
  const { data: discoverableCommands, isLoading: isLoadingDiscoverable } =
    useDiscoverableCommands();
  const { data: repos = [] } = useCommandRepos();
  const installMutation = useInstallCommand();
  const addRepoMutation = useAddCommandRepo();
  const removeRepoMutation = useRemoveCommandRepo();
  const restoreBuiltinMutation = useRestoreBuiltinCommandRepos();
  const refreshDiscoverableMutation = useRefreshDiscoverableCommands();
  const batchInstall = useBatchInstallCommands();

  // 检查各应用的 Commands 支持状态
  const { data: claudeSupported = true } = useAppCommandsSupport("claude");
  const { data: codexSupported = false } = useAppCommandsSupport("codex");
  const { data: geminiSupported = false } = useAppCommandsSupport("gemini");

  // 更新检测
  const {
    data: updateCheckResult,
    isLoading: isCheckingUpdates,
    isFetching: isFetchingUpdates,
  } = useCheckCommandsUpdates();
  const checkCommandsUpdatesByIdsMutation = useCheckCommandsUpdatesByIds();
  const fixCommandsHashMutation = useFixCommandsHash();
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

  // === Discovery 模式计算值 ===
  // 已安装的命令 ID 集合
  const installedIds = useMemo(() => {
    return new Set(commands.map((cmd) => cmd.id));
  }, [commands]);

  // 获取所有分类
  const categories = useMemo(() => {
    if (!discoverableCommands) return [];
    const cats = new Set<string>();
    discoverableCommands.forEach((cmd) => {
      if (cmd.category) cats.add(cmd.category);
    });
    return Array.from(cats).sort();
  }, [discoverableCommands]);

  // 按搜索词和分类筛选可发现的命令
  const filteredDiscoverableCommands = useMemo(() => {
    if (!discoverableCommands) return [];
    return discoverableCommands.filter((cmd) => {
      // 搜索过滤
      if (searchQuery && viewMode === "discovery") {
        const query = searchQuery.toLowerCase();
        const matchesName = cmd.name.toLowerCase().includes(query);
        const matchesDesc = cmd.description.toLowerCase().includes(query);
        const matchesKey = cmd.key.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesKey) return false;
      }
      // 分类过滤
      if (categoryFilter !== "all") {
        if (cmd.category !== categoryFilter) return false;
      }
      return true;
    });
  }, [discoverableCommands, searchQuery, categoryFilter, viewMode]);

  // 按仓库分组排序的命令列表（用于 "全部" 模式）
  const sortedFilteredDiscoverableCommands = useMemo(() => {
    if (filteredDiscoverableCommands.length === 0) return [];
    return [...filteredDiscoverableCommands].sort((a, b) => {
      // 先按仓库排序
      const repoCompare = `${a.repoOwner}/${a.repoName}`.localeCompare(
        `${b.repoOwner}/${b.repoName}`,
      );
      if (repoCompare !== 0) return repoCompare;
      // 再按命名空间排序
      const nsCompare = (a.namespace || "").localeCompare(b.namespace || "");
      if (nsCompare !== 0) return nsCompare;
      // 最后按名称排序
      return a.name.localeCompare(b.name);
    });
  }, [filteredDiscoverableCommands]);

  // 当前显示的命令列表（根据选择状态）
  const displayedDiscoveryCommands = useMemo(() => {
    // 全部模式：使用排序后的所有命令
    if (discoverySelection.type === "all") {
      return sortedFilteredDiscoverableCommands;
    }
    // 仓库/命名空间模式：使用选择的命令
    if (discoverySelection.commands.length > 0) {
      return discoverySelection.commands;
    }
    // fallback：返回排序后的所有命令
    return sortedFilteredDiscoverableCommands;
  }, [discoverySelection.type, discoverySelection.commands, sortedFilteredDiscoverableCommands]);

  // 计算未安装命令数量（基于当前显示的命令）
  const uninstalledCount = useMemo(() => {
    if (displayedDiscoveryCommands.length === 0) return 0;
    return displayedDiscoveryCommands.filter((cmd) => {
      const id = cmd.namespace
        ? `${cmd.namespace}/${cmd.filename}`
        : cmd.filename;
      return !installedIds.has(id);
    }).length;
  }, [displayedDiscoveryCommands, installedIds]);

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
    } else if (
      listSelection.type === "namespace" &&
      listSelection.namespaceId
    ) {
      result = result.filter(
        (c) => getNamespaceId(c) === listSelection.namespaceId,
      );
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
  const emptyStateType = useMemo(():
    | "all"
    | "repo"
    | "namespace"
    | "search" => {
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

  const handleCheckUpdates = useCallback(async () => {
    setUpdatesDismissed(false);
    try {
      // 先修复缺少 file_hash 的 Commands（静默执行）
      await fixCommandsHashMutation.mutateAsync();

      // 根据当前选择范围获取要检查的 Command IDs
      const commandIdsToCheck = filteredCommands.map((c) => c.id);

      if (commandIdsToCheck.length === 0) {
        toast.info(t("updates.noSkillsToCheck"));
        return;
      }

      // 显示检查范围提示
      toast.info(
        t("updates.checkingRange", { count: commandIdsToCheck.length }),
      );

      // 检查指定范围的 Commands 更新
      const result =
        await checkCommandsUpdatesByIdsMutation.mutateAsync(commandIdsToCheck);
      if (result.updateCount === 0) {
        toast.success(t("updates.noUpdates"));
      }
    } catch (error) {
      toast.error(t("updates.error.checkFailed"), {
        description: String(error),
      });
    }
  }, [
    filteredCommands,
    checkCommandsUpdatesByIdsMutation,
    fixCommandsHashMutation,
    t,
  ]);

  const handleUpdateAll = useCallback(async () => {
    if (updatableIds.length === 0) return;

    try {
      const result = await updateBatchMutation.mutateAsync(updatableIds);
      if (result.successCount > 0) {
        toast.success(
          t("updates.updateSuccess", { count: result.successCount }),
        );
        setUpdatesDismissed(true);
      }
      if (result.failedCount > 0) {
        toast.error(
          t("updates.updatePartialFailed", { count: result.failedCount }),
        );
      }
    } catch (error) {
      toast.error(t("updates.error.updateFailed"), {
        description: String(error),
      });
    }
  }, [updatableIds, updateBatchMutation, t]);

  const handleToggleApp = async (
    id: string,
    app: AppType,
    enabled: boolean,
  ) => {
    try {
      await toggleAppMutation.mutateAsync({ id, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleScopeChange = async (
    commandId: string,
    newScope: InstallScope,
  ) => {
    try {
      await changeScopeMutation.mutateAsync({
        id: commandId,
        scope: newScope.type,
        projectPath: newScope.type === "project" ? newScope.path : undefined,
        currentApp: "claude",
      });
      toast.success(t("scope.changeSuccess", "范围修改成功"), {
        closeButton: true,
      });
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
          toast.success(
            t("commands.uninstallSuccess", { name: command.name }),
            {
              closeButton: true,
            },
          );
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
      message: t("commands.uninstallAllConfirm", {
        count: filteredCommands.length,
      }),
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

  // === Discovery 模式处理函数 ===
  const handleRefreshDiscoverable = async () => {
    try {
      await refreshDiscoverableMutation.mutateAsync();
      toast.success(t("commands.refreshSuccess"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleInstallCommand = async (
    command: DiscoverableCommand,
    scope?: InstallScope,
  ) => {
    try {
      await installMutation.mutateAsync({
        command,
        currentApp: "claude",
        scope: scope?.type,
        projectPath: scope?.type === "project" ? scope.path : undefined,
      });
      toast.success(t("commands.installSuccess", { name: command.name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleBatchInstall = () => {
    if (displayedDiscoveryCommands.length === 0) return;
    batchInstall.startBatchInstall(displayedDiscoveryCommands, installedIds);
  };

  const handleAddRepo = async (repo: CommandRepo) => {
    await addRepoMutation.mutateAsync(repo);
    toast.success(t("commands.repo.addSuccess"), { closeButton: true });
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    await removeRepoMutation.mutateAsync({ owner, name });
    toast.success(t("commands.repo.removeSuccess"), { closeButton: true });
  };

  const handleRestoreBuiltinRepos = async () => {
    try {
      const count = await restoreBuiltinMutation.mutateAsync();
      if (count > 0) {
        toast.success(t("commands.repo.restoreSuccess", { count }), {
          closeButton: true,
        });
      } else {
        toast.info(t("commands.repo.noMissing"), {
          closeButton: true,
        });
      }
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleToggleDiscoveryNode = (nodeId: string) => {
    setDiscoveryExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const isCommandInstalled = (cmd: DiscoverableCommand) => {
    const id = cmd.namespace
      ? `${cmd.namespace}/${cmd.filename}`
      : cmd.filename;
    return installedIds.has(id);
  };

  const getCommandUpdateStatus = (
    cmd: DiscoverableCommand,
  ): UpdateCheckResult | undefined => {
    if (!updateCheckResult) return undefined;
    const id = cmd.namespace
      ? `${cmd.namespace}/${cmd.filename}`
      : cmd.filename;
    return getResourceUpdateStatus(updateCheckResult, id);
  };

  // Import 模式仍然单独返回
  if (viewMode === "import") {
    return <CommandImport onBack={() => setViewMode("list")} />;
  }

  return (
    <ContentContainer
      variant="wide"
      className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden"
    >
      {/* ========== 统一 Header ========== */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
        {/* 左侧: 图标 + 标题 */}
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

        {/* 右侧: 按钮组 */}
        <div className="flex items-center gap-2">
          {/* 仓库管理 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRepoManager(true)}
          >
            <Settings size={16} className="mr-1" />
            {t("common.repoManager")}
          </Button>

          {/* 已安装模式：导入 + 检查更新 + 批量卸载 */}
          {viewMode === "list" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode("import")}
              >
                <FileUp size={16} className="mr-1" />
                {t("commands.import")}
              </Button>
              <CheckUpdatesButton
                isChecking={
                  isCheckingUpdates ||
                  isFetchingUpdates ||
                  checkCommandsUpdatesByIdsMutation.isPending ||
                  fixCommandsHashMutation.isPending
                }
                onCheck={handleCheckUpdates}
                result={updateCheckResult}
                disabled={isLoading}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleUninstallAll}
                disabled={
                  filteredCommands.length === 0 ||
                  uninstallBatchMutation.isPending
                }
                className="text-destructive hover:text-destructive"
              >
                <Trash2 size={16} className="mr-1" />
                {t("commands.uninstallAll")}
              </Button>
            </>
          )}

          {/* 发现模式：刷新 */}
          {viewMode === "discovery" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshDiscoverable}
              disabled={refreshDiscoverableMutation.isPending}
            >
              <RefreshCw
                size={16}
                className={
                  refreshDiscoverableMutation.isPending
                    ? "animate-spin mr-1"
                    : "mr-1"
                }
              />
              {t("common.refresh")}
            </Button>
          )}

          {/* 模式切换 Tabs（放在最右侧） */}
          <Tabs
            value={viewMode === "discovery" ? "discovery" : "list"}
            onValueChange={(val) => setViewMode(val as ViewMode)}
          >
            <TabsList className="h-8">
              <TabsTrigger value="list" className="text-xs px-3 min-w-[80px]">
                {t("common.installed")}
              </TabsTrigger>
              <TabsTrigger
                value="discovery"
                className="text-xs px-3 min-w-[80px]"
              >
                {t("common.discover")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* ========== 搜索行 + 统计信息 ========== */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* 搜索框 */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder={t("commands.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) =>
                viewMode === "list"
                  ? handleSearchChange(e.target.value)
                  : setSearchQuery(e.target.value)
              }
              className="pl-9"
            />
          </div>

          {/* 已安装模式：统计信息 */}
          {viewMode === "list" && (
            <div className="text-sm text-muted-foreground">
              {t("commands.installed", { count: enabledCounts.total })} ·{" "}
              {t("commands.apps.claude")}: {enabledCounts.claude} ·{" "}
              {t("commands.apps.codex")}: {enabledCounts.codex} ·{" "}
              {t("commands.apps.gemini")}: {enabledCounts.gemini}
            </div>
          )}

          {/* 发现模式：分类过滤 + 统计 + 批量安装 */}
          {viewMode === "discovery" && (
            <>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder={t("commands.allCategories")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("commands.allCategories")}
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">
                {t("commands.available", {
                  count: filteredDiscoverableCommands.length,
                })}{" "}
                · {t("commands.installedCount", { count: installedIds.size })}
              </div>
              <BatchInstallCommandsButton
                uninstalledCount={uninstalledCount}
                state={batchInstall.state}
                onStartInstall={handleBatchInstall}
                onCancelInstall={batchInstall.cancelInstall}
              />
            </>
          )}
        </div>
      </div>

      {/* Conflict Detection Panel (只在 list 模式显示) */}
      {viewMode === "list" && (
        <ConflictDetectionPanel className="flex-shrink-0 mb-4" />
      )}

      {/* Update Notification Bar (只在 list 模式显示) */}
      {viewMode === "list" &&
        updateCheckResult &&
        !updatesDismissed &&
        (updateCheckResult.updateCount > 0 ||
          updateCheckResult.deletedCount > 0) && (
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

      {/* ========== 已安装模式内容 ========== */}
      {viewMode === "list" && (
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
              onScopeChange={handleScopeChange}
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
      )}

      {/* ========== 发现模式内容 ========== */}
      {viewMode === "discovery" && (
        <div className="flex-1 flex gap-4 overflow-hidden pb-4">
          {/* Left Panel - Tree Navigation */}
          <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("commands.browseByRepo")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingDiscoverable ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  {t("commands.loadingDiscoverable")}
                </div>
              ) : (
                <CommandDiscoveryTree
                  commands={filteredDiscoverableCommands}
                  selection={discoverySelection}
                  onSelectionChange={setDiscoverySelection}
                  expandedNodes={discoveryExpandedNodes}
                  onToggleNode={handleToggleDiscoveryNode}
                />
              )}
            </div>
          </div>

          {/* Right Panel - Command List */}
          <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium text-foreground">
                {discoverySelection.type === "all"
                  ? t("commands.allCommands")
                  : discoverySelection.type === "repo"
                    ? discoverySelection.id
                    : discoverySelection.id?.split("/").slice(-1)[0]}
              </h3>
              <p className="text-xs text-muted-foreground">
                {displayedDiscoveryCommands.length}{" "}
                {t("commands.title").toLowerCase()}
              </p>
            </div>
            {displayedDiscoveryCommands.length > 0 ? (
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-2">
                  {displayedDiscoveryCommands.map((cmd) => (
                    <CommandListItem
                      key={cmd.key}
                      command={cmd}
                      isInstalled={isCommandInstalled(cmd)}
                      updateStatus={getCommandUpdateStatus(cmd)}
                      isInstalling={
                        installMutation.isPending &&
                        installMutation.variables?.command.key === cmd.key
                      }
                      onInstall={(scope) => handleInstallCommand(cmd, scope)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <FileText size={48} className="mb-4 opacity-30" />
                <p className="text-sm">{t("commands.noCommandsFound")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 仓库管理面板 */}
      {showRepoManager && (
        <CommandRepoManager
          repos={repos}
          commands={discoverableCommands || []}
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onRestoreBuiltin={handleRestoreBuiltinRepos}
          onClose={() => setShowRepoManager(false)}
        />
      )}

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
    </ContentContainer>
  );
};

/**
 * 命令列表项组件（发现模式用）
 */
interface CommandListItemProps {
  command: DiscoverableCommand;
  isInstalled: boolean;
  updateStatus?: UpdateCheckResult;
  isInstalling: boolean;
  onInstall: (scope?: InstallScope) => void;
}

const CommandListItem: React.FC<CommandListItemProps> = ({
  command,
  isInstalled,
  updateStatus,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);

  // 处理安装按钮点击 - 打开范围选择对话框
  const handleInstallClick = () => {
    setScopeDialogOpen(true);
  };

  // 处理范围选择确认
  const handleScopeConfirm = async (scope: InstallScope) => {
    await onInstall(scope);
    setScopeDialogOpen(false);
  };

  return (
    <>
      <div className="rounded-lg border border-border bg-background/50 p-3">
        {/* 头部：命令名 + 分类 + 安装按钮 */}
        <div className="flex items-start gap-3">
          <FileText
            size={16}
            className="text-muted-foreground flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{command.name}</span>
              {isInstalled && updateStatus && (
                <UpdateBadge status={updateStatus} size="sm" />
              )}
              {command.category && (
                <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary flex-shrink-0">
                  {command.category}
                </span>
              )}
            </div>
            {/* 描述 */}
            <p className="text-xs text-muted-foreground mb-2">
              {command.description}
            </p>
            {/* 文档链接 */}
            {command.readmeUrl && (
              <a
                href={command.readmeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink size={12} />
                {t("commands.viewDocumentation")}
              </a>
            )}
          </div>

          {/* 安装按钮 */}
          <div className="flex-shrink-0">
            {isInstalled ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <Check size={12} />
                {t("commands.installed")}
              </span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={handleInstallClick}
                disabled={isInstalling}
                className="h-7 text-xs gap-1"
              >
                {isInstalling ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Download size={12} />
                )}
                {t("commands.install")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 安装范围选择对话框 */}
      <InstallScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        resourceType="command"
        resourceName={command.name}
        onInstall={handleScopeConfirm}
        isLoading={isInstalling}
      />
    </>
  );
};

export default CommandsPage;
