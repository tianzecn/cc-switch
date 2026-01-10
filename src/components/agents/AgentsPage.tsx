import React, { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  RefreshCw,
  FileUp,
  Search,
  Trash2,
  Settings,
  Download,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useInstalledAgents,
  useAgentNamespaces,
  useToggleAgentApp,
  useUninstallAgent,
  useUninstallAgentsBatch,
  useOpenAgentInEditor,
  useAppAgentsSupport,
  useDiscoverableAgents,
  useInstallAgent,
  useAgentRepos,
  useAddAgentRepo,
  useRemoveAgentRepo,
  useRefreshDiscoverableAgents,
  useChangeAgentScope,
  type InstalledAgent,
  type AppType,
  type DiscoverableAgent,
  type CommandRepo,
} from "@/hooks/useAgents";
import { useBatchInstallAgents } from "@/hooks/useBatchInstallAgents";
import { ContentContainer } from "@/components/layout";
import { InstallScopeDialog, type InstallScope } from "@/components/common/InstallScopeDialog";
import {
  useCheckAgentsUpdates,
  useCheckAgentsUpdatesByIds,
  useUpdateAgentsBatch,
  useUpdatableResourceIds,
  useFixAgentsHash,
  getResourceUpdateStatus,
  type UpdateCheckResult,
} from "@/hooks/useResourceUpdates";
import { CheckUpdatesButton, UpdateNotificationBar, UpdateBadge } from "@/components/updates";
import { AgentNamespaceTree } from "./AgentNamespaceTree";
import { GroupedAgentsList } from "./GroupedAgentsList";
import { AgentImport } from "./AgentImport";
import { AgentDiscoveryTree, type DiscoverySelection } from "./AgentDiscoveryTree";
import { BatchInstallAgentsButton } from "./BatchInstallAgentsButton";
import { CommandRepoManager } from "@/components/commands/CommandRepoManager";
import { toast } from "sonner";
import { settingsApi } from "@/lib/api";
import type { TreeSelection } from "@/types/tree";
import { createAllSelection } from "@/types/tree";

type ViewMode = "list" | "discovery" | "import";

/**
 * Agents 管理主页面
 * 三栏布局：Tree Sidebar | Grouped List | Detail Panel
 */
export const AgentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selection, setSelection] = useState<TreeSelection>(createAllSelection());
  const [selectedAgent, setSelectedAgent] = useState<InstalledAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // === Discovery 模式状态 ===
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [discoveryExpandedNodes, setDiscoveryExpandedNodes] = useState<Set<string>>(new Set());
  const [discoverySelection, setDiscoverySelection] = useState<DiscoverySelection>({
    type: "all",
    id: null,
    agents: [],
  });

  // Queries
  const { data: agents, isLoading } = useInstalledAgents();
  const { data: namespaces } = useAgentNamespaces();
  const toggleAppMutation = useToggleAgentApp();
  const uninstallMutation = useUninstallAgent();
  const uninstallBatchMutation = useUninstallAgentsBatch();
  const openEditorMutation = useOpenAgentInEditor();
  const changeScopeMutation = useChangeAgentScope();

  // === Discovery 模式 Queries ===
  const { data: discoverableAgents, isLoading: isLoadingDiscoverable } = useDiscoverableAgents();
  const { data: repos = [] } = useAgentRepos();
  const installMutation = useInstallAgent();
  const addRepoMutation = useAddAgentRepo();
  const removeRepoMutation = useRemoveAgentRepo();
  const refreshDiscoverableMutation = useRefreshDiscoverableAgents();
  const batchInstall = useBatchInstallAgents();

  // 检查各应用的 Agents 支持状态
  const { data: claudeSupported = true } = useAppAgentsSupport("claude");
  const { data: codexSupported = false } = useAppAgentsSupport("codex");
  const { data: geminiSupported = false } = useAppAgentsSupport("gemini");

  // 更新检测
  const {
    data: updateCheckResult,
    isLoading: isCheckingUpdates,
    isFetching: isFetchingUpdates,
  } = useCheckAgentsUpdates();
  const checkAgentsUpdatesByIdsMutation = useCheckAgentsUpdatesByIds();
  const fixAgentsHashMutation = useFixAgentsHash();
  const [updatesDismissed, setUpdatesDismissed] = useState(false);
  const updateBatchMutation = useUpdateAgentsBatch();
  const updatableIds = useUpdatableResourceIds(updateCheckResult);

  const appSupport = useMemo(
    () => ({
      claude: claudeSupported,
      codex: codexSupported,
      gemini: geminiSupported,
    }),
    [claudeSupported, codexSupported, geminiSupported],
  );

  // 根据选中状态筛选 agents
  const filteredAgents = useMemo(() => {
    if (!agents) return [];

    let result = agents;

    // 根据树选择筛选
    if (selection.type === "repo" && selection.repoId) {
      const repoId = selection.repoId;
      result = result.filter((agent) => {
        const agentRepoId =
          agent.repoOwner && agent.repoName
            ? `${agent.repoOwner}/${agent.repoName}`
            : "local";
        return agentRepoId === repoId;
      });
    } else if (selection.type === "namespace" && selection.namespaceId) {
      // namespaceId 格式: "owner/repo/namespace" 或 "local/namespace"
      // 需要正确分割 repoId 和 namespace
      const namespaceId = selection.namespaceId;
      let repoId: string;
      let namespace: string;

      if (namespaceId.startsWith("local/")) {
        // 本地仓库: "local/namespace"
        repoId = "local";
        namespace = namespaceId.slice(6); // 去掉 "local/"
      } else {
        // 远程仓库: "owner/repo/namespace"
        // 找到第二个 "/" 的位置来分割
        const firstSlash = namespaceId.indexOf("/");
        const secondSlash = namespaceId.indexOf("/", firstSlash + 1);
        if (secondSlash !== -1) {
          repoId = namespaceId.slice(0, secondSlash);
          namespace = namespaceId.slice(secondSlash + 1);
        } else {
          // 没有命名空间的情况: "owner/repo"
          repoId = namespaceId;
          namespace = "";
        }
      }

      result = result.filter((agent) => {
        const agentRepoId =
          agent.repoOwner && agent.repoName
            ? `${agent.repoOwner}/${agent.repoName}`
            : "local";
        const agentNamespace = agent.namespace || "";
        return agentRepoId === repoId && agentNamespace === namespace;
      });
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((agent) => {
        const matchesId = agent.id.toLowerCase().includes(query);
        const matchesName = agent.name?.toLowerCase().includes(query);
        const matchesDesc = agent.description?.toLowerCase().includes(query);
        return matchesId || matchesName || matchesDesc;
      });
    }

    return result;
  }, [agents, selection, searchQuery]);

  // 统计各应用启用数量
  const enabledCounts = useMemo(() => {
    const counts = { claude: 0, codex: 0, gemini: 0, total: 0 };
    if (!agents) return counts;
    counts.total = agents.length;
    agents.forEach((agent) => {
      if (agent.apps.claude) counts.claude++;
      if (agent.apps.codex) counts.codex++;
      if (agent.apps.gemini) counts.gemini++;
    });
    return counts;
  }, [agents]);

  // === Discovery 模式计算值 ===
  // 已安装的 Agent ID 集合
  const installedIds = useMemo(() => {
    if (!agents) return new Set<string>();
    return new Set(agents.map((agent) => agent.id));
  }, [agents]);

  // 按搜索词筛选可发现的 Agents
  const filteredDiscoverableAgents = useMemo(() => {
    if (!discoverableAgents) return [];
    if (!searchQuery || viewMode !== "discovery") return discoverableAgents;

    const query = searchQuery.toLowerCase();
    return discoverableAgents.filter((agent) => {
      const matchesName = agent.name.toLowerCase().includes(query);
      const matchesDesc = agent.description?.toLowerCase().includes(query);
      const matchesKey = agent.key.toLowerCase().includes(query);
      return matchesName || matchesDesc || matchesKey;
    });
  }, [discoverableAgents, searchQuery, viewMode]);

  // 当前显示的 agent 列表（根据选择状态）
  const displayedDiscoveryAgents = useMemo(() => {
    if (discoverySelection.type !== "all" && discoverySelection.agents.length > 0) {
      return discoverySelection.agents;
    }
    return [];
  }, [discoverySelection]);

  // 计算未安装 agent 数量（基于当前显示的 agents）
  const uninstalledCount = useMemo(() => {
    if (displayedDiscoveryAgents.length === 0) return 0;
    return displayedDiscoveryAgents.filter((agent) => {
      const id = agent.namespace
        ? `${agent.namespace}/${agent.filename}`
        : agent.filename;
      return !installedIds.has(id);
    }).length;
  }, [displayedDiscoveryAgents, installedIds]);

  // 确定空状态类型
  const emptyStateType = useMemo(() => {
    if (searchQuery.trim()) return "search";
    if (selection.type === "namespace") return "namespace";
    if (selection.type === "repo") return "repo";
    return "all";
  }, [searchQuery, selection.type]);

  // 处理搜索 - 输入时切换到全部视图
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // 有搜索内容时自动切换到 "全部" 视图
    if (value.trim() && selection.type !== "all") {
      setSelection(createAllSelection());
    }
  };

  const handleCheckUpdates = useCallback(async () => {
    setUpdatesDismissed(false);
    try {
      // 先修复缺少 file_hash 的 Agents（静默执行）
      await fixAgentsHashMutation.mutateAsync();

      // 根据当前选择范围获取要检查的 Agent IDs
      const agentIdsToCheck = filteredAgents.map((a) => a.id);

      if (agentIdsToCheck.length === 0) {
        toast.info(t("updates.noSkillsToCheck"));
        return;
      }

      // 显示检查范围提示
      toast.info(t("updates.checkingRange", { count: agentIdsToCheck.length }));

      // 检查指定范围的 Agents 更新
      const result = await checkAgentsUpdatesByIdsMutation.mutateAsync(agentIdsToCheck);
      if (result.updateCount === 0) {
        toast.success(t("updates.noUpdates"));
      }
    } catch (error) {
      toast.error(t("updates.error.checkFailed"), {
        description: String(error),
      });
    }
  }, [filteredAgents, checkAgentsUpdatesByIdsMutation, fixAgentsHashMutation, t]);

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

  const handleToggleApp = async (
    agentId: string,
    app: AppType,
    enabled: boolean,
  ) => {
    try {
      await toggleAppMutation.mutateAsync({ id: agentId, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleScopeChange = async (agentId: string, newScope: InstallScope) => {
    try {
      await changeScopeMutation.mutateAsync({
        id: agentId,
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

  const handleUninstall = async (agentId: string) => {
    try {
      await uninstallMutation.mutateAsync(agentId);
      toast.success(t("agents.uninstallSuccess", { name: agentId }), {
        closeButton: true,
      });
      // 如果删除的是当前选中的 agent，清除选中
      if (selectedAgent?.id === agentId) {
        setSelectedAgent(null);
      }
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleOpenEditor = async (agentId: string) => {
    try {
      await openEditorMutation.mutateAsync(agentId);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleOpenDocs = async (url: string) => {
    try {
      await settingsApi.openExternal(url);
    } catch {
      // ignore
    }
  };

  const handleUninstallAll = async () => {
    if (!agents || agents.length === 0) return;

    const confirmed = window.confirm(
      t("agents.uninstallAllConfirm", { count: agents.length }),
    );
    if (!confirmed) return;

    try {
      const ids = agents.map((agent) => agent.id);
      const count = await uninstallBatchMutation.mutateAsync(ids);
      toast.success(t("agents.uninstallAllSuccess", { count }), {
        closeButton: true,
      });
      setSelectedAgent(null);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  // === Discovery 模式处理函数 ===
  const handleRefreshDiscoverable = async () => {
    try {
      await refreshDiscoverableMutation.mutateAsync();
      toast.success(t("agents.refreshSuccess"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleInstallAgent = async (agent: DiscoverableAgent, scope?: InstallScope) => {
    try {
      await installMutation.mutateAsync({
        agent,
        currentApp: "claude",
        scope: scope?.type,
        projectPath: scope?.type === "project" ? scope.path : undefined,
      });
      toast.success(t("agents.installSuccess", { name: agent.name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleBatchInstall = () => {
    if (displayedDiscoveryAgents.length === 0) return;
    batchInstall.startBatchInstall(displayedDiscoveryAgents, installedIds);
  };

  const handleAddRepo = async (repo: CommandRepo) => {
    await addRepoMutation.mutateAsync(repo);
    toast.success(t("agents.repo.addSuccess"), { closeButton: true });
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    await removeRepoMutation.mutateAsync({ owner, name });
    toast.success(t("agents.repo.removeSuccess"), { closeButton: true });
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

  const isAgentInstalled = (agent: DiscoverableAgent) => {
    const id = agent.namespace
      ? `${agent.namespace}/${agent.filename}`
      : agent.filename;
    return installedIds.has(id);
  };

  const getAgentUpdateStatus = (agent: DiscoverableAgent): UpdateCheckResult | undefined => {
    if (!updateCheckResult) return undefined;
    const id = agent.namespace
      ? `${agent.namespace}/${agent.filename}`
      : agent.filename;
    return getResourceUpdateStatus(updateCheckResult, id);
  };

  // Import 模式仍然单独返回
  if (viewMode === "import") {
    return <AgentImport onBack={() => setViewMode("list")} />;
  }

  return (
    <ContentContainer variant="wide" className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* ========== 统一 Header ========== */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
        {/* 左侧: 图标 + 标题 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("agents.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("agents.subtitle")}
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

          {/* 导入按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("import")}
          >
            <FileUp size={16} className="mr-1" />
            {t("agents.import")}
          </Button>

          {/* 已安装模式：检查更新 + 批量卸载 */}
          {viewMode === "list" && (
            <>
              <CheckUpdatesButton
                isChecking={isCheckingUpdates || isFetchingUpdates || checkAgentsUpdatesByIdsMutation.isPending || fixAgentsHashMutation.isPending}
                onCheck={handleCheckUpdates}
                result={updateCheckResult}
                disabled={isLoading}
              />
              {agents && agents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUninstallAll}
                  disabled={uninstallBatchMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} className="mr-1" />
                  {t("agents.uninstallAll")}
                </Button>
              )}
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
                className={refreshDiscoverableMutation.isPending ? "animate-spin mr-1" : "mr-1"}
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
              <TabsTrigger value="discovery" className="text-xs px-3 min-w-[80px]">
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
              placeholder={t("agents.searchPlaceholder")}
              value={searchQuery}
              onChange={handleSearchChange}
              className="pl-9"
            />
          </div>

          {/* 已安装模式：统计信息 */}
          {viewMode === "list" && (
            <div className="text-sm text-muted-foreground">
              {t("agents.installed", { count: enabledCounts.total })} ·{" "}
              {t("agents.apps.claude")}: {enabledCounts.claude} ·{" "}
              {t("agents.apps.codex")}: {enabledCounts.codex} ·{" "}
              {t("agents.apps.gemini")}: {enabledCounts.gemini}
            </div>
          )}

          {/* 发现模式：统计信息 + 批量安装 */}
          {viewMode === "discovery" && (
            <>
              <div className="text-sm text-muted-foreground">
                {t("agents.available", { count: filteredDiscoverableAgents.length })} ·{" "}
                {t("agents.installedCount", { count: installedIds.size })}
              </div>
              {uninstalledCount > 0 && (
                <BatchInstallAgentsButton
                  uninstalledCount={uninstalledCount}
                  state={batchInstall.state}
                  onStartInstall={handleBatchInstall}
                  onCancelInstall={batchInstall.cancelInstall}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Update Notification Bar */}
      {viewMode === "list" && updateCheckResult && !updatesDismissed && (updateCheckResult.updateCount > 0 || updateCheckResult.deletedCount > 0) && (
        <div className="flex-shrink-0 mb-4">
          <UpdateNotificationBar
            result={updateCheckResult}
            resourceLabel={t("agents.title")}
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
          <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden rounded-xl border border-border bg-muted/30 p-3">
            <AgentNamespaceTree
              agents={agents || []}
              namespaces={namespaces || []}
              selection={selection}
              onSelectionChange={setSelection}
            />
          </div>

          {/* Middle Content - Agents List */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
            <GroupedAgentsList
              agents={filteredAgents}
              selection={selection}
              selectedAgentId={selectedAgent?.id ?? null}
              onSelectAgent={setSelectedAgent}
              onToggleApp={handleToggleApp}
              onUninstall={handleUninstall}
              onOpenEditor={handleOpenEditor}
              onOpenDocs={handleOpenDocs}
              onScopeChange={handleScopeChange}
              appSupport={appSupport}
              isLoading={isLoading}
              emptyStateType={emptyStateType}
              updateCheckResult={updateCheckResult}
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
                {t("agents.browseByRepo")}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {isLoadingDiscoverable ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  {t("agents.loadingDiscoverable")}
                </div>
              ) : (
                <AgentDiscoveryTree
                  agents={filteredDiscoverableAgents}
                  expandedNodes={discoveryExpandedNodes}
                  onToggleNode={handleToggleDiscoveryNode}
                  selection={discoverySelection}
                  onSelectionChange={setDiscoverySelection}
                />
              )}
            </div>
          </div>

          {/* Right Panel - Agent List */}
          <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
            <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
              <h3 className="text-sm font-medium text-muted-foreground">
                {discoverySelection.type === "all"
                  ? t("agents.selectToView")
                  : t("agents.agentsInSelection", { count: displayedDiscoveryAgents.length })}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {displayedDiscoveryAgents.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                  {t("agents.selectRepoOrNamespace")}
                </div>
              ) : (
                <div className="space-y-2">
                  {displayedDiscoveryAgents.map((agent) => (
                    <AgentListItem
                      key={`${agent.repoOwner}/${agent.repoName}/${agent.namespace}/${agent.filename}`}
                      agent={agent}
                      isInstalled={isAgentInstalled(agent)}
                      isInstalling={installMutation.isPending}
                      updateStatus={getAgentUpdateStatus(agent)}
                      onInstall={(scope) => handleInstallAgent(agent, scope)}
                      onOpenDocs={handleOpenDocs}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 仓库管理面板 */}
      {showRepoManager && (
        <CommandRepoManager
          repos={repos}
          commands={
            (discoverableAgents || []) as unknown as import("@/hooks/useCommands").DiscoverableCommand[]
          }
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onClose={() => setShowRepoManager(false)}
        />
      )}
    </ContentContainer>
  );
};

export default AgentsPage;

// ========== 发现模式 Agent 列表项组件 ==========
interface AgentListItemProps {
  agent: DiscoverableAgent;
  isInstalled: boolean;
  isInstalling: boolean;
  updateStatus?: UpdateCheckResult;
  onInstall: (scope?: InstallScope) => void;
  onOpenDocs: (url: string) => void;
}

function AgentListItem({
  agent,
  isInstalled,
  isInstalling,
  updateStatus,
  onInstall,
  onOpenDocs,
}: AgentListItemProps) {
  const { t } = useTranslation();
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);

  const handleInstallClick = () => {
    setScopeDialogOpen(true);
  };

  const handleScopeConfirm = async (scope: InstallScope) => {
    await onInstall(scope);
    setScopeDialogOpen(false);
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{agent.name}</span>
          {isInstalled && (
            <span className="text-xs px-2 py-0.5 rounded bg-green-500/10 text-green-600 dark:text-green-400">
              {t("common.installed")}
            </span>
          )}
          {updateStatus?.hasUpdate && (
            <UpdateBadge status={updateStatus} />
          )}
        </div>
        {agent.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {agent.description}
          </p>
        )}
        <div className="text-xs text-muted-foreground/70 mt-1">
          {agent.namespace && <span>{agent.namespace}/</span>}
          {agent.filename}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-4">
        {agent.readmeUrl && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenDocs(agent.readmeUrl!)}
            title={t("agents.viewDocs")}
          >
            <ExternalLink size={16} />
          </Button>
        )}
        <Button
          variant={isInstalled ? "outline" : "default"}
          size="sm"
          onClick={handleInstallClick}
          disabled={isInstalled || isInstalling}
        >
          {isInstalling ? (
            <Loader2 size={16} className="animate-spin mr-1" />
          ) : isInstalled ? (
            <Check size={16} className="mr-1" />
          ) : (
            <Download size={16} className="mr-1" />
          )}
          {isInstalled ? t("common.installed") : t("common.install")}
        </Button>
      </div>

      {/* 安装范围选择对话框 */}
      <InstallScopeDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        resourceType="agent"
        resourceName={agent.name}
        onInstall={handleScopeConfirm}
        isLoading={isInstalling}
      />
    </div>
  );
}
