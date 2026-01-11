import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Webhook,
  RefreshCw,
  Filter,
  Settings,
  Search,
  Download,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInstalledHooks,
  useHookNamespaces,
  useSyncHooksToApps,
  useDiscoverableHooks,
  useInstallHook,
  useHookRepos,
  useAddHookRepo,
  useRemoveHookRepo,
  useRefreshDiscoverableHooks,
  useChangeHookScope,
  type HookEventType,
  type DiscoverableHook,
  type CommandRepo,
} from "@/hooks/useHooks";
import { HookNamespaceTree } from "./HookNamespaceTree";
import { HooksList } from "./HooksList";
import { HookDiscoveryTree } from "./HookDiscoveryTree";
import { CommandRepoManager } from "@/components/commands/CommandRepoManager";
import { InstallScopeDialog } from "@/components/common/InstallScopeDialog";
import type { InstallScope } from "@/components/common/ScopeBadge";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentContainer } from "@/components/layout";

type ViewMode = "list" | "discovery";

const EVENT_TYPES: HookEventType[] = [
  "PreToolUse",
  "PostToolUse",
  "PermissionRequest",
  "SessionEnd",
];

/**
 * Hooks 管理主页面
 * 统一管理架构：双栏布局 + 事件类型筛选 + 三应用开关
 */
// 事件类型对应的颜色
const EVENT_TYPE_COLORS: Record<HookEventType, string> = {
  PreToolUse: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PostToolUse: "bg-green-500/10 text-green-600 dark:text-green-400",
  PermissionRequest: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  SessionEnd: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

export const HooksPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null,
  );
  const [selectedEventTypes, setSelectedEventTypes] = useState<
    Set<HookEventType>
  >(new Set(EVENT_TYPES));
  const [searchQuery, setSearchQuery] = useState("");

  // === Discovery 模式状态 ===
  const [showRepoManager, setShowRepoManager] = useState(false);
  // 手风琴模式：只允许一个仓库展开
  const [discoveryExpandedRepoId, setDiscoveryExpandedRepoId] = useState<
    string | null
  >(null);
  const [discoverySelectedNamespace, setDiscoverySelectedNamespace] = useState<
    string | null
  >(null);
  const [discoveryNamespaceHooks, setDiscoveryNamespaceHooks] = useState<
    DiscoverableHook[]
  >([]);

  // Queries
  const { data: hooks, isLoading } = useInstalledHooks();
  const { data: namespaces } = useHookNamespaces();
  const syncMutation = useSyncHooksToApps();
  const changeScopeMutation = useChangeHookScope();

  // === Discovery 模式 Queries ===
  const { data: discoverableHooks, isLoading: isLoadingDiscoverable } =
    useDiscoverableHooks();
  const { data: repos = [] } = useHookRepos();
  const installMutation = useInstallHook();
  const addRepoMutation = useAddHookRepo();
  const removeRepoMutation = useRemoveHookRepo();
  const refreshDiscoverableMutation = useRefreshDiscoverableHooks();

  // 按命名空间和事件类型筛选 hooks
  const filteredHooks = useMemo(() => {
    if (!hooks) return [];
    let result = hooks;

    // 按命名空间筛选
    if (selectedNamespace !== null) {
      result = result.filter((hook) => hook.namespace === selectedNamespace);
    }

    // 按事件类型筛选
    if (selectedEventTypes.size < EVENT_TYPES.length) {
      result = result.filter((hook) => selectedEventTypes.has(hook.eventType));
    }

    // 按优先级排序
    return result.sort((a, b) => a.priority - b.priority);
  }, [hooks, selectedNamespace, selectedEventTypes]);

  // 统计各应用启用数量
  const enabledCounts = useMemo(() => {
    const counts = { claude: 0, codex: 0, gemini: 0, total: 0, enabled: 0 };
    if (!hooks) return counts;
    counts.total = hooks.length;
    hooks.forEach((hook) => {
      if (hook.enabled) counts.enabled++;
      if (hook.apps.claude) counts.claude++;
      if (hook.apps.codex) counts.codex++;
      if (hook.apps.gemini) counts.gemini++;
    });
    return counts;
  }, [hooks]);

  // 按事件类型统计
  const eventTypeCounts = useMemo(() => {
    const counts: Record<HookEventType, number> = {
      PreToolUse: 0,
      PostToolUse: 0,
      PermissionRequest: 0,
      SessionEnd: 0,
    };
    if (!hooks) return counts;
    hooks.forEach((hook) => {
      counts[hook.eventType]++;
    });
    return counts;
  }, [hooks]);

  // === Discovery 模式计算值 ===
  // 已安装的 Hook ID 集合
  const installedIds = useMemo(() => {
    if (!hooks) return new Set<string>();
    return new Set(hooks.map((hook) => hook.id));
  }, [hooks]);

  // 按搜索词筛选可发现的 Hooks
  const filteredDiscoverableHooks = useMemo(() => {
    if (!discoverableHooks) return [];
    if (!searchQuery || viewMode !== "discovery") return discoverableHooks;

    const query = searchQuery.toLowerCase();
    return discoverableHooks.filter((hook) => {
      const matchesName = hook.name.toLowerCase().includes(query);
      const matchesDesc = hook.description?.toLowerCase().includes(query);
      const matchesKey = hook.key.toLowerCase().includes(query);
      return matchesName || matchesDesc || matchesKey;
    });
  }, [discoverableHooks, searchQuery, viewMode]);

  const handleSync = async () => {
    try {
      const count = await syncMutation.mutateAsync();
      toast.success(t("hooks.syncSuccess", { count }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleScopeChange = async (hookId: string, newScope: InstallScope) => {
    try {
      await changeScopeMutation.mutateAsync({
        id: hookId,
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

  const toggleEventType = (eventType: HookEventType) => {
    setSelectedEventTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventType)) {
        newSet.delete(eventType);
      } else {
        newSet.add(eventType);
      }
      return newSet;
    });
  };

  // === Discovery 模式处理函数 ===
  const handleRefreshDiscoverable = async () => {
    try {
      await refreshDiscoverableMutation.mutateAsync();
      toast.success(t("hooks.refreshSuccess"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleInstallHook = async (
    hook: DiscoverableHook,
    scope?: InstallScope,
  ) => {
    try {
      await installMutation.mutateAsync({
        hook,
        currentApp: "claude",
        scope: scope?.type,
        projectPath: scope?.type === "project" ? scope.path : undefined,
      });
      toast.success(t("hooks.installSuccess", { name: hook.name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleAddRepo = async (repo: CommandRepo) => {
    await addRepoMutation.mutateAsync(repo);
    toast.success(t("hooks.repo.addSuccess"), { closeButton: true });
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    await removeRepoMutation.mutateAsync({ owner, name });
    toast.success(t("hooks.repo.removeSuccess"), { closeButton: true });
  };

  const handleSelectDiscoveryNamespace = (
    namespaceId: string,
    hooksInNamespace: DiscoverableHook[],
  ) => {
    setDiscoverySelectedNamespace(namespaceId);
    setDiscoveryNamespaceHooks(hooksInNamespace);
  };

  const isHookInstalled = (hook: DiscoverableHook) => {
    const id = hook.namespace
      ? `${hook.namespace}/${hook.filename}`
      : hook.filename;
    return installedIds.has(id);
  };

  return (
    <ContentContainer
      variant="wide"
      className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden"
    >
      {/* ========== 统一 Header ========== */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
        {/* 左侧: 图标 + 标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg">
            <Webhook size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("hooks.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("hooks.subtitle")}
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

          {/* 已安装模式：事件类型过滤 + 同步 */}
          {viewMode === "list" && (
            <>
              {/* Event Type Filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter size={16} className="mr-1" />
                    {selectedEventTypes.size === EVENT_TYPES.length
                      ? t("hooks.allEvents")
                      : t("hooks.filteredEvents", {
                          count: selectedEventTypes.size,
                        })}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {EVENT_TYPES.map((eventType) => (
                    <DropdownMenuCheckboxItem
                      key={eventType}
                      checked={selectedEventTypes.has(eventType)}
                      onCheckedChange={() => toggleEventType(eventType)}
                    >
                      {eventType} ({eventTypeCounts[eventType]})
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncMutation.isPending}
                title={t("hooks.syncTooltip")}
              >
                <RefreshCw
                  size={16}
                  className={
                    syncMutation.isPending ? "animate-spin mr-1" : "mr-1"
                  }
                />
                {t("hooks.sync")}
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
            value={viewMode}
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
          {/* 搜索框（仅发现模式显示） */}
          {viewMode === "discovery" && (
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="text"
                placeholder={t("hooks.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {/* 已安装模式：统计信息 */}
          {viewMode === "list" && (
            <div className="text-sm text-muted-foreground">
              {t("hooks.installed", { count: enabledCounts.total })} ·{" "}
              {t("hooks.enabled", { count: enabledCounts.enabled })} ·{" "}
              {t("hooks.apps.claude")}: {enabledCounts.claude} ·{" "}
              {t("hooks.apps.codex")}: {enabledCounts.codex} ·{" "}
              {t("hooks.apps.gemini")}: {enabledCounts.gemini}
            </div>
          )}

          {/* 发现模式：统计信息 */}
          {viewMode === "discovery" && (
            <div className="text-sm text-muted-foreground">
              {t("hooks.available", {
                count: filteredDiscoverableHooks.length,
              })}{" "}
              · {t("hooks.installedCount", { count: installedIds.size })}
            </div>
          )}
        </div>
      </div>

      {/* ========== 已安装模式内容 ========== */}
      {viewMode === "list" && (
        <div className="flex-1 flex gap-4 overflow-hidden pb-8">
          {/* Left Sidebar - Namespace Tree */}
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
            <HookNamespaceTree
              namespaces={namespaces || []}
              hooks={hooks}
              selectedNamespace={selectedNamespace}
              onSelectNamespace={setSelectedNamespace}
            />
          </div>

          {/* Right Content - Hooks List */}
          <div className="flex-1 overflow-hidden">
            <HooksList
              hooks={filteredHooks}
              isLoading={isLoading}
              selectedNamespace={selectedNamespace}
              onScopeChange={handleScopeChange}
            />
          </div>
        </div>
      )}

      {/* ========== 发现模式内容 ========== */}
      {viewMode === "discovery" && (
        <div className="flex-1 flex gap-4 overflow-hidden pb-4">
          {/* Left Panel - Tree Navigation */}
          <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("hooks.browseByRepo")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingDiscoverable ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  {t("hooks.loadingDiscoverable")}
                </div>
              ) : (
                <HookDiscoveryTree
                  hooks={filteredDiscoverableHooks}
                  selectedNamespace={discoverySelectedNamespace}
                  onSelectNamespace={handleSelectDiscoveryNamespace}
                  expandedRepoId={discoveryExpandedRepoId}
                  onExpandedChange={setDiscoveryExpandedRepoId}
                />
              )}
            </div>
          </div>

          {/* Right Panel - Hook List */}
          <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
            {discoverySelectedNamespace ? (
              <>
                <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
                  <h3 className="text-sm font-medium text-foreground">
                    {discoverySelectedNamespace.split("/").slice(-1)[0]}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {discoveryNamespaceHooks.length}{" "}
                    {t("hooks.title").toLowerCase()}
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-2">
                    {discoveryNamespaceHooks.map((hook) => (
                      <HookListItem
                        key={hook.key}
                        hook={hook}
                        isInstalled={isHookInstalled(hook)}
                        isInstalling={
                          installMutation.isPending &&
                          installMutation.variables?.hook.key === hook.key
                        }
                        onInstall={(scope) => handleInstallHook(hook, scope)}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <Webhook size={48} className="mb-4 opacity-30" />
                <p className="text-sm">{t("hooks.selectToView")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 仓库管理面板 */}
      {showRepoManager && (
        <CommandRepoManager
          repos={repos}
          commands={
            (discoverableHooks ||
              []) as unknown as import("@/hooks/useCommands").DiscoverableCommand[]
          }
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onClose={() => setShowRepoManager(false)}
        />
      )}
    </ContentContainer>
  );
};

/**
 * Hook 列表项组件（发现模式用）
 */
interface HookListItemProps {
  hook: DiscoverableHook;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: (scope?: InstallScope) => void;
}

const HookListItem: React.FC<HookListItemProps> = ({
  hook,
  isInstalled,
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
        <div className="flex items-start gap-3">
          <Webhook
            size={16}
            className="text-muted-foreground flex-shrink-0 mt-0.5"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">{hook.name}</span>
              <Badge
                variant="secondary"
                className={EVENT_TYPE_COLORS[hook.eventType]}
              >
                {hook.eventType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                #{hook.priority}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              {hook.description}
            </p>
            {hook.readmeUrl && (
              <a
                href={hook.readmeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink size={12} />
                {t("hooks.viewDocumentation")}
              </a>
            )}
          </div>

          <div className="flex-shrink-0">
            {isInstalled ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <Check size={12} />
                {t("hooks.installed")}
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
                {t("hooks.install")}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 安装范围选择对话框 */}
      <InstallScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        resourceType="hook"
        resourceName={hook.name}
        onInstall={handleScopeConfirm}
        isLoading={isInstalling}
      />
    </>
  );
};

export default HooksPage;
