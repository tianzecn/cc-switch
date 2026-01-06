import React, {
  useState,
  useMemo,
  forwardRef,
  useImperativeHandle,
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
import { Search, RefreshCw, Download, Compass, Sparkles, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { SkillNamespaceTree } from "./SkillNamespaceTree";
import { SkillDiscoveryTree } from "./SkillDiscoveryTree";
import { SkillsList } from "./SkillsList";
import { SkillDetailPanel } from "./SkillDetailPanel";
import { SkillConflictPanel } from "./SkillConflictPanel";
import { RepoManagerPanel } from "./RepoManagerPanel";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  useInstalledSkills,
  useToggleSkillApp,
  useUninstallSkill,
  useSkillConflicts,
  useScanUnmanagedSkills,
  useImportSkillsFromApps,
  useDiscoverableSkills,
  useInstallSkill,
  useSkillRepos,
  useAddSkillRepo,
  useRemoveSkillRepo,
  type InstalledSkill,
  type AppType,
} from "@/hooks/useSkills";
import type { DiscoverableSkill, SkillRepo } from "@/lib/api/skills";
import { formatSkillError } from "@/lib/errors/skillErrorParser";

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
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null,
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
  const [discoverySelectedNs, setDiscoverySelectedNs] = useState<string | null>(
    null,
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
  const installMutation = useInstallSkill();
  const importMutation = useImportSkillsFromApps();
  const addRepoMutation = useAddSkillRepo();
  const removeRepoMutation = useRemoveSkillRepo();

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

  // 按命名空间和搜索过滤 Skills
  const filteredSkills = useMemo(() => {
    let result = installedSkills;

    // 按命名空间过滤
    if (selectedNamespace !== null) {
      result = result.filter((s) => s.namespace === selectedNamespace);
    }

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
  }, [installedSkills, selectedNamespace, searchQuery]);

  // 发现模式的 Skills 列表
  const discoverySkills = useMemo(() => {
    if (viewMode !== "discovery") return [];

    let result = discoverableSkills.map((d) => {
      const installName =
        d.directory.split("/").pop()?.toLowerCase() ||
        d.directory.toLowerCase();
      return {
        ...d,
        installed: installedDirs.has(installName),
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
  }, [discoverableSkills, viewMode, filterStatus, searchQuery, installedDirs]);

  // 发现模式按命名空间过滤后的列表
  const filteredDiscoverySkills = useMemo(() => {
    // 如果选中了特定命名空间，显示该命名空间下的技能
    if (discoverySelectedNs !== null && discoveryNsSkills.length > 0) {
      // 将命名空间下的技能与已安装状态合并
      return discoveryNsSkills.map((d) => {
        const installName =
          d.directory.split("/").pop()?.toLowerCase() ||
          d.directory.toLowerCase();
        return {
          ...d,
          installed: installedDirs.has(installName),
        };
      });
    }
    // 否则显示全部
    return discoverySkills;
  }, [discoverySelectedNs, discoveryNsSkills, discoverySkills, installedDirs]);

  // Handlers
  const handleRefresh = () => {
    refetchInstalled();
    refetchRepos();
    if (viewMode === "discovery") {
      refetchDiscoverable();
    }
  };

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
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </Button>
            <Button
              variant={viewMode === "discovery" ? "default" : "outline"}
              size="sm"
              onClick={() =>
                setViewMode(viewMode === "discovery" ? "list" : "discovery")
              }
            >
              <Compass size={16} className="mr-1" />
              {t("skills.discover", "Discover")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleOpenImport}>
              <Download size={16} className="mr-1" />
              {t("skills.import", "Import")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRepoManagerOpen(true)}
            >
              <Settings size={16} className="mr-1" />
              {t("skills.repoManager", "Repository")}
            </Button>
          </div>
        </div>

        {/* Search & Stats Bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("skills.searchPlaceholder", "Search skills...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
          <div className="text-sm text-muted-foreground">
            {t("skills.installed", { count: stats.total })} ·{" "}
            {t("skills.apps.claude")}: {stats.claude} · {t("skills.apps.codex")}:{" "}
            {stats.codex} · {t("skills.apps.gemini")}: {stats.gemini}
          </div>
        </div>
      </div>

      {/* Conflict Panel */}
      {conflicts.length > 0 && (
        <div className="flex-shrink-0 mb-4">
          <SkillConflictPanel conflicts={conflicts} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Sidebar - Tree */}
        <div className="w-64 flex-shrink-0 overflow-y-auto">
          {viewMode === "list" ? (
            <SkillNamespaceTree
              skills={installedSkills}
              selectedNamespace={selectedNamespace}
              onSelectNamespace={setSelectedNamespace}
            />
          ) : viewMode === "discovery" ? (
            <SkillDiscoveryTree
              skills={discoverableSkills}
              selectedNamespace={discoverySelectedNs}
              onSelectNamespace={(nsId, skills) => {
                setDiscoverySelectedNs(nsId);
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
            <SkillsList
              skills={filteredSkills}
              selectedSkillId={selectedSkill?.id ?? null}
              onSelectSkill={setSelectedSkill}
              onToggleApp={handleToggleApp}
              onUninstall={handleUninstall}
              isLoading={loadingInstalled}
            />
          ) : viewMode === "discovery" ? (
            <DiscoveryList
              skills={filteredDiscoverySkills}
              onInstall={handleInstall}
              isLoading={loading}
              installingKey={installingKey}
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
}

const DiscoveryList: React.FC<DiscoveryListProps> = ({
  skills,
  onInstall,
  isLoading,
  installingKey,
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {skills.map((skill) => (
        <DiscoveryCard
          key={skill.key}
          skill={skill}
          onInstall={() => onInstall(skill)}
          isInstalling={installingKey === skill.key}
        />
      ))}
    </div>
  );
};

/**
 * 发现卡片组件
 */
interface DiscoveryCardProps {
  skill: DiscoverableSkill & { installed: boolean };
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
          <h4 className="font-medium truncate">{skill.name}</h4>
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
