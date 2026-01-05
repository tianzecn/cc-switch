import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Download, RefreshCw, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInstalledAgents,
  useAgentNamespaces,
  useRefreshAgentsFromSsot,
} from "@/hooks/useAgents";
import { AgentNamespaceTree } from "./AgentNamespaceTree";
import { AgentsList } from "./AgentsList";
import { AgentDiscovery } from "./AgentDiscovery";
import { AgentImport } from "./AgentImport";
import { toast } from "sonner";

type ViewMode = "list" | "discovery" | "import";

/**
 * Agents 管理主页面
 * v3.11.0 统一管理架构：双栏布局 + 三应用开关
 */
export const AgentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null
  );

  // Queries
  const { data: agents, isLoading } = useInstalledAgents();
  const { data: namespaces } = useAgentNamespaces();
  const refreshMutation = useRefreshAgentsFromSsot();

  // 按命名空间筛选 agents
  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    if (selectedNamespace === null) return agents;
    return agents.filter((agent) => agent.namespace === selectedNamespace);
  }, [agents, selectedNamespace]);

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

      {/* Stats Bar */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("agents.installed", { count: enabledCounts.total })} ·{" "}
          {t("agents.apps.claude")}: {enabledCounts.claude} ·{" "}
          {t("agents.apps.codex")}: {enabledCounts.codex} ·{" "}
          {t("agents.apps.gemini")}: {enabledCounts.gemini}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-8">
        {/* Left Sidebar - Namespace Tree */}
        <div className="w-64 flex-shrink-0 flex flex-col overflow-hidden">
          <AgentNamespaceTree
            namespaces={namespaces || []}
            agents={agents}
            selectedNamespace={selectedNamespace}
            onSelectNamespace={setSelectedNamespace}
          />
        </div>

        {/* Right Content - Agents List */}
        <div className="flex-1 overflow-hidden">
          <AgentsList
            agents={filteredAgents}
            isLoading={isLoading}
            selectedNamespace={selectedNamespace}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentsPage;
