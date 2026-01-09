import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, RefreshCw, Download, Compass, Sparkles, Loader2, Settings, Trash2 } from "lucide-react";
import { CheckUpdatesButton, UpdateNotificationBar, UpdateBadge } from "@/components/updates";
import { toast } from "sonner";
import { SkillNamespaceTree } from "./SkillNamespaceTree";
import { SkillDiscoveryTree } from "./SkillDiscoveryTree";
import { GroupedSkillsList } from "./GroupedSkillsList";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { SkillConflictPanel } from "./SkillConflictPanel";
import { RepoManagerPanel } from "./RepoManagerPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useInstalledSkills,
  useToggleSkillApp,
  useUninstallSkill,
  useUninstallSkillsBatch,
  useSkillConflicts,
  useScanUnmanagedSkills,
  useImportSkillsFromApps,
  useDiscoverableSkills,
  useInstallSkill,
  useSkillRepos,
  useAddSkillRepo,
  useRemoveSkillRepo,
  useRestoreBuiltinSkillRepos,
  type InstalledSkill,
  type AppType,
} from "@/hooks/useSkills";
import type { DiscoverableSkill, SkillRepo } from "@/lib/api/skills";
import { formatSkillError } from "@/lib/errors/skillErrorParser";
import type { TreeSelection } from "@/types/tree";
import { createAllSelection } from "@/types/tree";
import { useBatchInstall } from "@/hooks/useBatchInstall";
import { BatchInstallButton } from "./BatchInstallButton";
import {
  useCheckSkillsUpdates,
  useCheckSkillsUpdatesByIds,
  useUpdateSkillsBatch,
  useUpdatableResourceIds,
  useFixSkillsHash,
  getResourceUpdateStatus,
  type UpdateCheckResult,
} from "@/hooks/useResourceUpdates";

/** 视图模式 */
type ViewMode = "list" | "discovery" | "import";

interface SkillsPageNewProps {
  initialApp?: AppType;
}

export interface SkillsPageNewHandle {
  refresh: () => void;
  openRepoManager: () => void;
}

/**
 * Skills 统一管理页面（双栏布局）
 *
 * 左侧：命名空间树
 * 右侧：Skills 列表 + 详情面板
 */
export const SkillsPageNew = forwardRef<
  SkillsPageNewHandle,
  SkillsPageNewProps
>(({ initialApp = "claude" }, ref) => {
  const { t } = useTranslation();

  // 状态
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  // 列表模式：树选中状态
  const [listSelection, setListSelection] = useState<TreeSelection>(
    createAllSelection(),
  );
  const [selectedSkill, setSelectedSkill] = useState<InstalledSkill | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "installed" | "uninstalled"
  >("all");
  const [repoManagerOpen, setRepoManagerOpen] = useState(false);

  // 发现模式状态
  const [discoverySelection, setDiscoverySelection] = useState<TreeSelection>(
    createAllSelection(),
  );
  const [discoveryNsSkills, setDiscoveryNsSkills] = useState<
    DiscoverableSkill[]
  >([]);
  const [discoveryExpandedNodes, setDiscoveryExpandedNodes] = useState<
    Set<string>
  >(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  // 正在安装的技能 key（用于显示 loading 状态）
  const [installingKey, setInstallingKey] = useState<string | null>(null);

  // Queries
  const {
    data: installedSkills = [],
    isLoading: loadingInstalled,
    refetch: refetchInstalled,
  } = useInstalledSkills();
  const { data: conflicts = [] } = useSkillConflicts();
  const {
    data: discoverableSkills = [],
    isLoading: loadingDiscoverable,
    isFetching: fetchingDiscoverable,
    refetch: refetchDiscoverable,
  } = useDiscoverableSkills();
  const { data: repos = [], refetch: refetchRepos } = useSkillRepos();
  const { data: unmanagedSkills, refetch: scanUnmanaged } =
    useScanUnmanagedSkills();

  // Mutations
  const toggleAppMutation = useToggleSkillApp();
  const uninstallMutation = useUninstallSkill();
  const uninstallBatchMutation = useUninstallSkillsBatch();
  const installMutation = useInstallSkill();
  const importMutation = useImportSkillsFromApps();
  const addRepoMutation = useAddSkillRepo();
  const removeRepoMutation = useRemoveSkillRepo();
  const restoreBuiltinMutation = useRestoreBuiltinSkillRepos();

  // 批量安装 Hook
  const {
    state: batchInstallState,
    startBatchInstall,
    cancelInstall: cancelBatchInstall,
  } = useBatchInstall();

  // 更新检测 Hook
  const {
    data: updateCheckResult,
    isLoading: isCheckingUpdates,
    isFetching: isFetchingUpdates,
  } = useCheckSkillsUpdates();
  const checkSkillsUpdatesByIdsMutation = useCheckSkillsUpdatesByIds();
  const updateSkillsBatchMutation = useUpdateSkillsBatch();
  const fixSkillsHashMutation = useFixSkillsHash();
  const updatableSkillIds = useUpdatableResourceIds(updateCheckResult);
  const [updatesDismissed, setUpdatesDismissed] = useState(false);

  // 统计数据
  const stats = useMemo(() => {
    const counts = { total: 0, claude: 0, codex: 0, gemini: 0 };
    installedSkills.forEach((skill) => {
      counts.total++;
      if (skill.apps.claude) counts.claude++;
      if (skill.apps.codex) counts.codex++;
      if (skill.apps.gemini) counts.gemini++;
    });
    return counts;
  }, [installedSkills]);

  // 已安装目录集合（用于发现模式）
  const installedDirs = useMemo(() => {
    return new Set(installedSkills.map((s) => s.directory.toLowerCase()));
  }, [installedSkills]);

  // 根据 TreeSelection 计算仓库 key
  const getRepoKey = useCallback((skill: InstalledSkill): string => {
    return skill.repoOwner && skill.repoName
      ? `${skill.repoOwner}/${skill.repoName}`
      : "local";
  }, []);

  // 根据 TreeSelection 计算命名空间 ID
  const getNamespaceId = useCallback((skill: InstalledSkill): string => {
    const repoKey = getRepoKey(skill);
    return `${repoKey}/${skill.namespace || ""}`;
  }, [getRepoKey]);

  // 按树选中状态和搜索过滤 Skills
  const filteredSkills = useMemo(() => {
    let result = installedSkills;

    // 按树选中状态过滤
    if (listSelection.type === "repo" && listSelection.repoId) {
      // 选中仓库：显示该仓库下所有 Skills
      result = result.filter((s) => getRepoKey(s) === listSelection.repoId);
    } else if (listSelection.type === "namespace" && listSelection.namespaceId) {
      // 选中命名空间：显示该命名空间下的 Skills
      result = result.filter((s) => getNamespaceId(s) === listSelection.namespaceId);
    }
    // type === "all" 时不过滤

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.description?.toLowerCase().includes(query) ?? false) ||
          s.directory.toLowerCase().includes(query),
      );
    }

    return result;
  }, [installedSkills, listSelection, searchQuery, getRepoKey, getNamespaceId]);

  // 发现模式的 Skills 列表
  const discoverySkills = useMemo(() => {
    if (viewMode !== "discovery") return [];

    let result = discoverableSkills.map((d) => {
      const installName =
        d.directory.split("/").pop()?.toLowerCase() ||
        d.directory.toLowerCase();
      const installed = installedDirs.has(installName);

      // 查找已安装版本的更新状态
      let updateStatus: UpdateCheckResult | undefined = undefined;
      if (installed && updateCheckResult) {
        const installedSkill = installedSkills.find(
          (s) => s.directory.toLowerCase() === installName
        );
        if (installedSkill) {
          updateStatus = getResourceUpdateStatus(updateCheckResult, installedSkill.id);
        }
      }

      return {
        ...d,
        installed,
        updateStatus,
      };
    });

    // 按安装状态过滤
    if (filterStatus === "installed") {
      result = result.filter((s) => s.installed);
    } else if (filterStatus === "uninstalled") {
      result = result.filter((s) => !s.installed);
    }

    // 按搜索词过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.directory.toLowerCase().includes(query),
      );
    }

    return result;
  }, [discoverableSkills, viewMode, filterStatus, searchQuery, installedDirs, updateCheckResult, installedSkills]);

  // 发现模式按树选中状态过滤后的列表
  const filteredDiscoverySkills = useMemo(() => {
    // 如果选中了特定仓库或命名空间，显示对应技能
    if (discoverySelection.type !== "all" && discoveryNsSkills.length > 0) {
      // 将命名空间下的技能与已安装状态和更新状态合并
      return discoveryNsSkills.map((d) => {
        const installName =
          d.directory.split("/").pop()?.toLowerCase() ||
          d.directory.toLowerCase();
        const installed = installedDirs.has(installName);

        // 查找已安装版本的更新状态
        let updateStatus: UpdateCheckResult | undefined = undefined;
        if (installed && updateCheckResult) {
          const installedSkill = installedSkills.find(
            (s) => s.directory.toLowerCase() === installName
          );
          if (installedSkill) {
            updateStatus = getResourceUpdateStatus(updateCheckResult, installedSkill.id);
          }
        }

        return {
          ...d,
          installed,
          updateStatus,
        };
      });
    }
    // 否则显示全部
    return discoverySkills;
  }, [discoverySelection, discoveryNsSkills, discoverySkills, installedDirs, updateCheckResult, installedSkills]);

  // 计算空状态类型
  const emptyStateType = useMemo((): "all" | "repo" | "namespace" | "search" => {
    if (searchQuery.trim()) return "search";
    if (listSelection.type === "namespace") return "namespace";
    if (listSelection.type === "repo") return "repo";
    return "all";
  }, [searchQuery, listSelection]);

  // 搜索处理：输入时自动切换到"全部"视图
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchQuery(value);
      // 输入搜索词时自动切换到"全部"视图
      if (value.trim() && listSelection.type !== "all") {
        setListSelection(createAllSelection());
      }
    },
    [listSelection],
  );

  // Handlers
  const handleRefresh = () => {
    refetchInstalled();
    refetchRepos();
    if (viewMode === "discovery") {
      refetchDiscoverable();
    }
  };

  const handleCheckUpdates = useCallback(async () => {
    setUpdatesDismissed(false);
    try {
      // 先修复缺少 file_hash 的 Skills（静默执行）
      await fixSkillsHashMutation.mutateAsync();

      // 根据当前选择范围获取要检查的 Skill IDs
      const skillIdsToCheck = filteredSkills.map((s) => s.id);

      if (skillIdsToCheck.length === 0) {
        toast.info(t("updates.noSkillsToCheck", "没有可检查的 Skills"));
        return;
      }

      // 显示检查范围提示
      toast.info(t("updates.checkingRange", { count: skillIdsToCheck.length }));

      // 检查指定范围的 Skills 更新
      const result = await checkSkillsUpdatesByIdsMutation.mutateAsync(skillIdsToCheck);
      if (result.updateCount === 0) {
        toast.success(t("updates.noUpdates"));
      }
    } catch (error) {
      toast.error(t("updates.error.checkFailed"), {
        description: String(error),
      });
    }
  }, [filteredSkills, checkSkillsUpdatesByIdsMutation, fixSkillsHashMutation, t]);

  const handleUpdateAll = useCallback(async () => {
    if (updatableSkillIds.length === 0) return;
    try {
      const result = await updateSkillsBatchMutation.mutateAsync(updatableSkillIds);
      if (result.successCount > 0) {
        toast.success(t("updates.updateSuccess"), {
          description: `${result.successCount} ${t("skills.title")}`,
        });
      }
      if (result.failedCount > 0) {
        toast.error(t("updates.updateFailed"), {
          description: `${result.failedCount} ${t("skills.title")}`,
        });
      }
      setUpdatesDismissed(true);
    } catch (error) {
      toast.error(t("updates.error.updateFailed", { error: String(error) }));
    }
  }, [updatableSkillIds, updateSkillsBatchMutation, t]);

  useImperativeHandle(ref, () => ({
    refresh: handleRefresh,
    openRepoManager: () => setRepoManagerOpen(true),
  }));

  const handleToggleApp = async (
    skillId: string,
    app: AppType,
    enabled: boolean,
  ) => {
    try {
      await toggleAppMutation.mutateAsync({ id: skillId, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleUninstall = (skillId: string) => {
    const skill = installedSkills.find((s) => s.id === skillId);
    if (!skill) return;

    setConfirmDialog({
      isOpen: true,
      title: t("skills.uninstall"),
      message: t("skills.uninstallConfirm", { name: skill.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(skillId);
          setConfirmDialog(null);
          setSelectedSkill(null);
          toast.success(t("skills.uninstallSuccess", { name: skill.name }), {
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

  const handleUninstallAll = () => {
    if (filteredSkills.length === 0) return;

    setConfirmDialog({
      isOpen: true,
      title: t("skills.uninstallAll"),
      message: t("skills.uninstallAllConfirm", { count: filteredSkills.length }),
      onConfirm: async () => {
        try {
          const ids = filteredSkills.map((s) => s.id);
          const count = await uninstallBatchMutation.mutateAsync(ids);
          setConfirmDialog(null);
          setSelectedSkill(null);
          toast.success(t("skills.uninstallAllSuccess", { count }), {
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

  const handleInstall = async (skill: DiscoverableSkill) => {
    setInstallingKey(skill.key);
    try {
      await installMutation.mutateAsync({
        skill,
        currentApp: initialApp,
      });
      toast.success(t("skills.installSuccess", { name: skill.name }), {
        closeButton: true,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const { title, description } = formatSkillError(
        errorMessage,
        t,
        "skills.installFailed",
      );
      toast.error(title, {
        description,
        duration: 10000,
      });
    } finally {
      setInstallingKey(null);
    }
  };

  const handleOpenImport = async () => {
    try {
      const result = await scanUnmanaged();
      if (!result.data || result.data.length === 0) {
        toast.success(t("skills.noUnmanagedFound"), { closeButton: true });
        return;
      }
      setImportDialogOpen(true);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleImport = async (directories: string[]) => {
    try {
      const imported = await importMutation.mutateAsync(directories);
      setImportDialogOpen(false);
      toast.success(t("skills.importSuccess", { count: imported.length }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleAddRepo = async (repo: SkillRepo) => {
    try {
      await addRepoMutation.mutateAsync(repo);
      toast.success(
        t("skills.repo.addSuccess", {
          owner: repo.owner,
          name: repo.name,
        }),
        { closeButton: true },
      );
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    try {
      await removeRepoMutation.mutateAsync({ owner, name });
      toast.success(t("skills.repo.removeSuccess", { owner, name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleRestoreBuiltinRepos = async () => {
    try {
      const count = await restoreBuiltinMutation.mutateAsync();
      if (count > 0) {
        toast.success(t("skills.repo.restoreSuccess", { count }), {
          closeButton: true,
        });
      } else {
        toast.info(t("skills.repo.noMissing"), {
          closeButton: true,
        });
      }
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  // 批量安装处理函数
  const handleBatchInstall = useCallback(() => {
    // 获取当前显示的技能列表（去除已安装标记的原始数据）
    const skillsToInstall = filteredDiscoverySkills.map((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { installed, ...skill } = s;
      return skill as DiscoverableSkill;
    });
    startBatchInstall(skillsToInstall, installedDirs, initialApp);
  }, [filteredDiscoverySkills, installedDirs, initialApp, startBatchInstall]);

  const loading =
    loadingInstalled ||
    (viewMode === "discovery" && (loadingDiscoverable || fetchingDiscoverable));

  return (
    <div className="mx-auto max-w-[72rem] h-[calc(100vh-8rem)] flex flex-col overflow-hidden px-6">
      {/* Header */}
      <div className="flex-shrink-0 py-4">
        {/* Title & Actions */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">
                {t("skills.title", "Skills")}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t("skills.description", "Manage your Claude Code skills")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 仓库管理 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRepoManagerOpen(true)}
            >
              <Settings size={16} className="mr-1" />
              {t("common.repoManager")}
            </Button>

            {/* 已安装模式：导入 + 检查更新 + 批量卸载 */}
            {viewMode === "list" && (
              <>
                <Button variant="outline" size="sm" onClick={handleOpenImport}>
                  <Download size={16} className="mr-1" />
                  {t("skills.import", "Import")}
                </Button>
                <CheckUpdatesButton
                  isChecking={isCheckingUpdates || isFetchingUpdates || checkSkillsUpdatesByIdsMutation.isPending || fixSkillsHashMutation.isPending}
                  onCheck={handleCheckUpdates}
                  result={updateCheckResult}
                  disabled={loading || filteredSkills.length === 0}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUninstallAll}
                  disabled={filteredSkills.length === 0 || uninstallBatchMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} />
                  <span className="ml-2">{t("skills.uninstallAll")}</span>
                </Button>
              </>
            )}

            {/* 发现模式：刷新 */}
            {viewMode === "discovery" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                <span className="ml-2">{t("common.refresh")}</span>
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
                <TabsTrigger value="discovery" className="text-xs px-3 min-w-[80px]">
                  {t("common.discover")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("skills.searchPlaceholder", "Search skills...")}
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          {viewMode === "discovery" && (
            <Select
              value={filterStatus}
              onValueChange={(val) =>
                setFilterStatus(val as "all" | "installed" | "uninstalled")
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("skills.filter.all", "All")}
                </SelectItem>
                <SelectItem value="installed">
                  {t("skills.filter.installed", "Installed")}
                </SelectItem>
                <SelectItem value="uninstalled">
                  {t("skills.filter.uninstalled", "Not Installed")}
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Stats */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {viewMode === "list" ? (
              <>
                {t("skills.installed", { count: stats.total })}
              </>
            ) : (
              <>
                {t("skills.available", { count: discoverySkills.length })} · {t("skills.installedCount", { count: stats.total })}
              </>
            )}
          </div>

          {/* 发现模式：Install All */}
          {viewMode === "discovery" && batchInstallState && (
            <BatchInstallButton
              uninstalledCount={filteredDiscoverySkills.filter((s) => !s.installed).length}
              state={batchInstallState}
              onStartInstall={handleBatchInstall}
              onCancelInstall={cancelBatchInstall}
              disabled={batchInstallState.isInstalling}
            />
          )}
        </div>
      </div>

      {/* Conflict Panel */}
      {conflicts.length > 0 && (
        <div className="flex-shrink-0 mb-4">
          <SkillConflictPanel conflicts={conflicts} />
        </div>
      )}

      {/* Update Notification Bar */}
      {updateCheckResult && !updatesDismissed && (updateCheckResult.updateCount > 0 || updateCheckResult.deletedCount > 0) && (
        <div className="flex-shrink-0 mb-4">
          <UpdateNotificationBar
            result={updateCheckResult}
            resourceLabel={t("skills.title")}
            onUpdateAll={handleUpdateAll}
            onDismiss={() => setUpdatesDismissed(true)}
            isUpdating={updateSkillsBatchMutation.isPending}
          />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Sidebar - Tree */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          {viewMode === "list" ? (
            <SkillNamespaceTree
              skills={installedSkills}
              selection={listSelection}
              onSelectionChange={setListSelection}
            />
          ) : viewMode === "discovery" ? (
            <SkillDiscoveryTree
              skills={discoverableSkills}
              selection={discoverySelection}
              onSelectionChange={(selection, skills) => {
                setDiscoverySelection(selection);
                setDiscoveryNsSkills(skills);
              }}
              expandedNodes={discoveryExpandedNodes}
              onToggleNode={(nodeId) => {
                setDiscoveryExpandedNodes((prev) => {
                  const next = new Set(prev);
                  if (next.has(nodeId)) {
                    next.delete(nodeId);
                  } else {
                    next.add(nodeId);
                  }
                  return next;
                });
              }}
            />
          ) : null}
        </div>

        {/* Middle - Skills List */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "list" ? (
            <GroupedSkillsList
              skills={filteredSkills}
              selection={listSelection}
              selectedSkillId={selectedSkill?.id ?? null}
              onSelectSkill={setSelectedSkill}
              onToggleApp={handleToggleApp}
              onUninstall={handleUninstall}
              isLoading={loadingInstalled}
              emptyStateType={emptyStateType}
              updateCheckResult={updateCheckResult}
            />
          ) : viewMode === "discovery" ? (
            <DiscoveryList
              skills={filteredDiscoverySkills}
              onInstall={handleInstall}
              isLoading={loading}
              installingKey={installingKey}
              batchState={batchInstallState}
            />
          ) : null}
        </div>

        {/* Right Sidebar - Detail Panel */}
        {selectedSkill && viewMode === "list" && (
          <div className="w-80 flex-shrink-0">
            <SkillDetailPanel
              skill={selectedSkill}
              onClose={() => setSelectedSkill(null)}
            />
          </div>
        )}
      </div>

      {/* Dialogs */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}

      {importDialogOpen && unmanagedSkills && (
        <ImportSkillsDialog
          skills={unmanagedSkills}
          onImport={handleImport}
          onClose={() => setImportDialogOpen(false)}
        />
      )}

      {repoManagerOpen && (
        <RepoManagerPanel
          repos={repos}
          skills={discoverySkills}
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onRestoreBuiltin={handleRestoreBuiltinRepos}
          onClose={() => setRepoManagerOpen(false)}
        />
      )}
    </div>
  );
});

SkillsPageNew.displayName = "SkillsPageNew";

/**
 * 发现列表组件
 */
interface DiscoveryListProps {
  skills: Array<DiscoverableSkill & { installed: boolean }>;
  onInstall: (skill: DiscoverableSkill) => void;
  isLoading: boolean;
  installingKey: string | null;
  /** 批量安装状态（用于显示安装进度） */
  batchState?: import("@/hooks/useBatchInstall").BatchInstallState;
}

const DiscoveryList: React.FC<DiscoveryListProps> = ({
  skills,
  onInstall,
  isLoading,
  installingKey,
  batchState,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Compass size={48} className="text-muted-foreground/50 mb-4" />
        <p className="text-lg font-medium">
          {t("skills.empty", "No skills found")}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t("skills.emptyDescription", "Add a repository to discover skills")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Skills 列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {skills.map((skill) => (
          <DiscoveryCard
            key={skill.key}
            skill={skill}
            onInstall={() => onInstall(skill)}
            isInstalling={installingKey === skill.key || Boolean(batchState?.isInstalling && batchState?.currentName === skill.name)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * 发现卡片组件
 */
interface DiscoveryCardProps {
  skill: DiscoverableSkill & { installed: boolean; updateStatus?: UpdateCheckResult };
  onInstall: () => void;
  isInstalling: boolean;
}

const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  skill,
  onInstall,
  isInstalling,
}) => {
  const { t } = useTranslation();

  return (
    <div className="p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{skill.name}</h4>
            {skill.installed && skill.updateStatus && (
              <UpdateBadge status={skill.updateStatus} size="sm" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {skill.description}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            {skill.repoOwner}/{skill.repoName}
          </p>
        </div>
        <Button
          size="sm"
          variant={skill.installed ? "secondary" : "default"}
          disabled={skill.installed || isInstalling}
          onClick={onInstall}
          className="ml-3 flex-shrink-0"
        >
          {isInstalling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              {t("skills.installing", "Installing...")}
            </>
          ) : skill.installed ? (
            t("skills.installed", "Installed")
          ) : (
            t("skills.install", "Install")
          )}
        </Button>
      </div>
    </div>
  );
};

/**
 * 导入对话框
 */
interface ImportSkillsDialogProps {
  skills: Array<{
    directory: string;
    name: string;
    description?: string;
    foundIn: string[];
  }>;
  onImport: (directories: string[]) => void;
  onClose: () => void;
}

const ImportSkillsDialog: React.FC<ImportSkillsDialogProps> = ({
  skills,
  onImport,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(
    new Set(skills.map((s) => s.directory)),
  );

  const toggleSelect = (directory: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(directory)) {
      newSelected.delete(directory);
    } else {
      newSelected.add(directory);
    }
    setSelected(newSelected);
  };

  const handleImport = () => {
    onImport(Array.from(selected));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <h2 className="text-lg font-semibold mb-2">{t("skills.import")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {t("skills.importDescription")}
        </p>

        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {skills.map((skill) => (
            <label
              key={skill.directory}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(skill.directory)}
                onChange={() => toggleSelect(skill.directory)}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium">{skill.name}</div>
                {skill.description && (
                  <div className="text-sm text-muted-foreground line-clamp-1">
                    {skill.description}
                  </div>
                )}
                <div className="text-xs text-muted-foreground/70 mt-1">
                  {t("skills.foundIn")}: {skill.foundIn.join(", ")}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={selected.size === 0}>
            {t("skills.importSelected", { count: selected.size })}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SkillsPageNew;
