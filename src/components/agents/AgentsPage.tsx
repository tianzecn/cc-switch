import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Download, RefreshCw, FileUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useInstalledAgents,
  useAgentNamespaces,
  useRefreshAgentsFromSsot,
  useToggleAgentApp,
  useUninstallAgent,
  useOpenAgentInEditor,
  useAppAgentsSupport,
  type InstalledAgent,
  type AppType,
} from "@/hooks/useAgents";
import { AgentNamespaceTree } from "./AgentNamespaceTree";
import { GroupedAgentsList } from "./GroupedAgentsList";
import { AgentDiscovery } from "./AgentDiscovery";
import { AgentImport } from "./AgentImport";
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

  // Queries
  const { data: agents, isLoading } = useInstalledAgents();
  const { data: namespaces } = useAgentNamespaces();
  const refreshMutation = useRefreshAgentsFromSsot();
  const toggleAppMutation = useToggleAgentApp();
  const uninstallMutation = useUninstallAgent();
  const openEditorMutation = useOpenAgentInEditor();

  // 检查各应用的 Agents 支持状态
  const { data: claudeSupported = true } = useAppAgentsSupport("claude");
  const { data: codexSupported = false } = useAppAgentsSupport("codex");
  const { data: geminiSupported = false } = useAppAgentsSupport("gemini");

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
      const [repoId, ...nsParts] = selection.namespaceId.split("/");
      const namespace = nsParts.join("/");
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
    if (searchQuery) {
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

  // 确定空状态类型
  const emptyStateType = useMemo(() => {
    if (searchQuery) return "search";
    if (selection.type === "namespace") return "namespace";
    if (selection.type === "repo") return "repo";
    return "all";
  }, [searchQuery, selection.type]);

  // 处理搜索 - 输入时切换到全部视图
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // 有搜索内容时自动切换到 "全部" 视图
    if (value && selection.type !== "all") {
      setSelection(createAllSelection());
    }
  };

  const handleRefresh = async () => {
    try {
      const count = await refreshMutation.mutateAsync();
      toast.success(t("agents.refreshSuccess", { count }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

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

  if (viewMode === "discovery") {
    return <AgentDiscovery onBack={() => setViewMode("list")} />;
  }

  if (viewMode === "import") {
    return <AgentImport onBack={() => setViewMode("list")} />;
  }

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
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

        <div className="flex items-center gap-2">
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
            <span className="ml-2">{t("agents.refresh")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("import")}
          >
            <FileUp size={16} />
            <span className="ml-2">{t("agents.import")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("discovery")}
          >
            <Download size={16} />
            <span className="ml-2">{t("agents.discover")}</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex-shrink-0 mb-4">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("agents.searchPlaceholder", "Search agents...")}
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("agents.installed", { count: enabledCounts.total })} ·{" "}
          {t("agents.apps.claude")}: {enabledCounts.claude} ·{" "}
          {t("agents.apps.codex")}: {enabledCounts.codex} ·{" "}
          {t("agents.apps.gemini")}: {enabledCounts.gemini}
        </div>
      </div>

      {/* Main Content - Three Column Layout */}
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
            appSupport={appSupport}
            isLoading={isLoading}
            emptyStateType={emptyStateType}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
