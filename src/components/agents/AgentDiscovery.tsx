import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Search,
  Download,
  Check,
  Loader2,
  RefreshCw,
  Settings,
  Bot,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useDiscoverableAgents,
  useInstalledAgents,
  useInstallAgent,
  useAgentRepos,
  useAddAgentRepo,
  useRemoveAgentRepo,
  useRefreshDiscoverableAgents,
  type DiscoverableAgent,
  type CommandRepo,
} from "@/hooks/useAgents";
import { toast } from "sonner";
import { CommandRepoManager } from "@/components/commands/CommandRepoManager";
import { AgentDiscoveryTree } from "./AgentDiscoveryTree";

interface AgentDiscoveryProps {
  onBack: () => void;
}

/**
 * Agent 发现页面（双栏布局）
 * 左侧：树形结构浏览（repo → namespace → agents）
 * 右侧：Agent 详情面板
 */
export const AgentDiscovery: React.FC<AgentDiscoveryProps> = ({
  onBack,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);
  const [namespaceAgents, setNamespaceAgents] = useState<DiscoverableAgent[]>([]);

  // Queries
  const { data: discoverableAgents, isLoading } = useDiscoverableAgents();
  const { data: installedAgents } = useInstalledAgents();
  const { data: repos = [] } = useAgentRepos();
  const installMutation = useInstallAgent();
  const addRepoMutation = useAddAgentRepo();
  const removeRepoMutation = useRemoveAgentRepo();
  const refreshMutation = useRefreshDiscoverableAgents();

  // 已安装的 Agent ID 集合
  const installedIds = useMemo(() => {
    if (!installedAgents) return new Set<string>();
    return new Set(installedAgents.map((agent) => agent.id));
  }, [installedAgents]);

  // 筛选 Agents
  const filteredAgents = useMemo(() => {
    if (!discoverableAgents) return [];

    return discoverableAgents.filter((agent) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = agent.name.toLowerCase().includes(query);
        const matchesDesc = agent.description.toLowerCase().includes(query);
        const matchesKey = agent.key.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesKey) return false;
      }
      return true;
    });
  }, [discoverableAgents, searchQuery]);

  const handleInstall = async (agent: DiscoverableAgent) => {
    try {
      await installMutation.mutateAsync({
        agent,
        currentApp: "claude",
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

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success(t("agents.refreshSuccess"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleAddRepo = async (repo: CommandRepo) => {
    await addRepoMutation.mutateAsync(repo);
    toast.success(t("agents.repo.addSuccess"), { closeButton: true });
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    await removeRepoMutation.mutateAsync({ owner, name });
    toast.success(t("agents.repo.removeSuccess"), { closeButton: true });
  };

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectNamespace = (namespaceId: string, agents: DiscoverableAgent[]) => {
    setSelectedNamespace(namespaceId);
    setNamespaceAgents(agents);
  };

  const isAgentInstalled = (agent: DiscoverableAgent) => {
    const id = agent.namespace ? `${agent.namespace}/${agent.filename}` : agent.filename;
    return installedIds.has(id);
  };

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {t("agents.discoverTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("agents.discoverSubtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRepoManager(true)}
        >
          <Settings size={16} />
          <span className="ml-2">{t("agents.repo.manage")}</span>
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
          <span className="ml-2">{t("common.refresh")}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("agents.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("agents.available", { count: filteredAgents.length })} ·{" "}
          {t("agents.installedCount", { count: installedIds.size })}
        </div>
      </div>

      {/* Main Content - 双栏布局 */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-4">
        {/* Left Panel - Tree Navigation */}
        <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("agents.browseByRepo")}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Loader2 size={20} className="animate-spin mr-2" />
                {t("agents.loadingDiscoverable")}
              </div>
            ) : (
              <AgentDiscoveryTree
                agents={filteredAgents}
                selectedNamespace={selectedNamespace}
                onSelectNamespace={handleSelectNamespace}
                expandedNodes={expandedNodes}
                onToggleNode={handleToggleNode}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Agent List */}
        <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          {selectedNamespace ? (
            <>
              <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
                <h3 className="text-sm font-medium text-foreground">
                  {selectedNamespace.split("/").slice(-1)[0]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {namespaceAgents.length} {t("agents.title").toLowerCase()}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-2">
                  {namespaceAgents.map((agent) => (
                    <AgentListItem
                      key={agent.key}
                      agent={agent}
                      isInstalled={isAgentInstalled(agent)}
                      isInstalling={
                        installMutation.isPending &&
                        installMutation.variables?.agent.key === agent.key
                      }
                      onInstall={() => handleInstall(agent)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Bot size={48} className="mb-4 opacity-30" />
              <p className="text-sm">{t("agents.selectToView")}</p>
            </div>
          )}
        </div>
      </div>

      {/* 仓库管理面板 */}
      {showRepoManager && (
        <CommandRepoManager
          repos={repos}
          commands={discoverableAgents || []}
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onClose={() => setShowRepoManager(false)}
        />
      )}
    </div>
  );
};

/**
 * Agent 列表项组件
 */
interface AgentListItemProps {
  agent: DiscoverableAgent;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  isInstalled,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="flex items-start gap-3">
        <Bot size={16} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{agent.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{agent.description}</p>
          {agent.readmeUrl && (
            <a
              href={agent.readmeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} />
              {t("agents.viewDocumentation")}
            </a>
          )}
        </div>

        <div className="flex-shrink-0">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <Check size={12} />
              {t("agents.installed")}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onInstall}
              disabled={isInstalling}
              className="h-7 text-xs gap-1"
            >
              {isInstalling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {t("agents.install")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDiscovery;
