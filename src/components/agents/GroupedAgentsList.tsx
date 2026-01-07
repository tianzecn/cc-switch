import React, { useMemo, useRef, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, HardDrive, Folder, Bot, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentListItem } from "./AgentListItem";
import type { InstalledAgent, AppType } from "@/hooks/useAgents";
import type { TreeSelection } from "@/types/tree";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ConfirmDialog";

/** 分组后的数据结构 */
interface GroupedData {
  repoId: string;
  repoName: string;
  isLocal: boolean;
  namespaces: Array<{
    namespaceId: string;
    namespaceName: string;
    agents: InstalledAgent[];
  }>;
}

interface GroupedAgentsListProps {
  agents: InstalledAgent[];
  selection: TreeSelection;
  selectedAgentId: string | null;
  onSelectAgent: (agent: InstalledAgent | null) => void;
  onToggleApp: (agentId: string, app: AppType, enabled: boolean) => void;
  onUninstall: (agentId: string) => void;
  onOpenEditor: (agentId: string) => void;
  onOpenDocs?: (url: string) => void;
  appSupport?: {
    claude: boolean;
    codex: boolean;
    gemini: boolean;
  };
  isLoading?: boolean;
  /** 分页相关 */
  pageSize?: number;
  /** 空状态类型 */
  emptyStateType?: "all" | "repo" | "namespace" | "search";
}

/**
 * 分组 Agents 列表组件
 * 根据选中状态决定分组方式：
 * - all: 按 仓库→命名空间 完整层级分组
 * - repo: 按命名空间分组
 * - namespace: 不分组，直接显示
 */
export const GroupedAgentsList: React.FC<GroupedAgentsListProps> = ({
  agents,
  selection,
  selectedAgentId,
  onSelectAgent,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  onOpenDocs,
  appSupport = { claude: true, codex: false, gemini: false },
  isLoading = false,
  pageSize = 50,
  emptyStateType = "all",
}) => {
  const { t } = useTranslation();
  const [displayCount, setDisplayCount] = useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    agentId: string;
    agentName: string;
  } | null>(null);

  // 构建分组数据
  const groupedData = useMemo((): GroupedData[] => {
    if (agents.length === 0) return [];

    // 按仓库分组
    const repoMap = new Map<string, Map<string, InstalledAgent[]>>();

    for (const agent of agents) {
      const repoKey =
        agent.repoOwner && agent.repoName
          ? `${agent.repoOwner}/${agent.repoName}`
          : "local";
      const namespace = agent.namespace || "";

      if (!repoMap.has(repoKey)) {
        repoMap.set(repoKey, new Map());
      }

      const nsMap = repoMap.get(repoKey)!;
      if (!nsMap.has(namespace)) {
        nsMap.set(namespace, []);
      }

      nsMap.get(namespace)!.push(agent);
    }

    // 构建分组结构
    const result: GroupedData[] = [];

    for (const [repoKey, nsMap] of repoMap) {
      const isLocal = repoKey === "local";

      // 命名空间排序：根命名空间在前
      const sortedNs = Array.from(nsMap.entries()).sort(([a], [b]) => {
        if (a === "") return -1;
        if (b === "") return 1;
        return a.localeCompare(b);
      });

      const namespaces = sortedNs.map(([ns, nsAgents]) => ({
        namespaceId: `${repoKey}/${ns}`,
        namespaceName: ns || t("agents.rootNamespace", "Root"),
        agents: nsAgents.sort((a, b) => a.id.localeCompare(b.id)),
      }));

      result.push({
        repoId: repoKey,
        repoName: isLocal ? t("agents.localAgents", "Local Agents") : repoKey,
        isLocal,
        namespaces,
      });
    }

    // 仓库排序：本地在前
    return result.sort((a, b) => {
      if (a.isLocal) return -1;
      if (b.isLocal) return 1;
      return a.repoName.localeCompare(b.repoName);
    });
  }, [agents, t]);

  // 是否有更多数据
  const hasMore = displayCount < agents.length;
  const remainingCount = agents.length - displayCount;

  // 加载更多
  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + pageSize, agents.length));
  }, [pageSize, agents.length]);

  // IntersectionObserver 自动加载
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, handleLoadMore]);

  // 重置分页当 agents 变化
  React.useEffect(() => {
    setDisplayCount(pageSize);
  }, [agents, pageSize]);

  // 处理卸载确认
  const handleUninstallClick = (agentId: string, agentName: string) => {
    setConfirmDialog({
      isOpen: true,
      agentId,
      agentName,
    });
  };

  const handleConfirmUninstall = () => {
    if (confirmDialog) {
      onUninstall(confirmDialog.agentId);
      setConfirmDialog(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return <EmptyState type={emptyStateType} />;
  }

  // 根据选中状态决定渲染方式
  const shouldShowRepoHeaders = selection.type === "all";
  const shouldShowNamespaceHeaders = selection.type === "all" || selection.type === "repo";

  // 计算当前显示的分组数据（考虑分页）
  const displayedGroupData = useMemo(() => {
    let count = 0;
    const result: GroupedData[] = [];

    for (const repo of groupedData) {
      const displayedNamespaces = [];

      for (const ns of repo.namespaces) {
        const remainingSlots = displayCount - count;
        if (remainingSlots <= 0) break;

        const displayedAgents = ns.agents.slice(0, remainingSlots);
        count += displayedAgents.length;

        if (displayedAgents.length > 0) {
          displayedNamespaces.push({
            ...ns,
            agents: displayedAgents,
          });
        }
      }

      if (displayedNamespaces.length > 0) {
        result.push({
          ...repo,
          namespaces: displayedNamespaces,
        });
      }
    }

    return result;
  }, [groupedData, displayCount]);

  return (
    <div className="space-y-4">
      {displayedGroupData.map((repo) => (
        <div key={repo.repoId}>
          {/* 仓库 Sticky Header */}
          {shouldShowRepoHeaders && (
            <RepoStickyHeader
              repoName={repo.repoName}
              isLocal={repo.isLocal}
            />
          )}

          {repo.namespaces.map((ns) => (
            <div key={ns.namespaceId}>
              {/* 命名空间 Sub Header */}
              {shouldShowNamespaceHeaders && (
                <NamespaceSubHeader
                  namespaceName={ns.namespaceName}
                  indent={shouldShowRepoHeaders}
                />
              )}

              {/* Agents 列表 */}
              <div className={cn("space-y-2", shouldShowNamespaceHeaders && "mt-2")}>
                {ns.agents.map((agent) => (
                  <AgentListItem
                    key={agent.id}
                    agent={agent}
                    isSelected={selectedAgentId === agent.id}
                    onSelect={() =>
                      onSelectAgent(selectedAgentId === agent.id ? null : agent)
                    }
                    onToggleApp={(app, enabled) =>
                      onToggleApp(agent.id, app, enabled)
                    }
                    onUninstall={() => handleUninstallClick(agent.id, agent.name || agent.id)}
                    onOpenEditor={() => onOpenEditor(agent.id)}
                    onOpenDocs={
                      agent.readmeUrl && onOpenDocs
                        ? () => onOpenDocs(agent.readmeUrl!)
                        : undefined
                    }
                    appSupport={appSupport}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* 加载更多区域 */}
      {hasMore && (
        <div ref={loadMoreRef} className="flex flex-col items-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            className="gap-2"
          >
            <Loader2 className="h-4 w-4" />
            {t("common.loadMore", "Load more")} ({remainingCount})
          </Button>
        </div>
      )}

      {/* 确认删除对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={t("agents.uninstall")}
          message={t("agents.uninstallConfirm", { name: confirmDialog.agentName })}
          onConfirm={handleConfirmUninstall}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

/**
 * 仓库 Sticky Header
 */
interface RepoStickyHeaderProps {
  repoName: string;
  isLocal: boolean;
}

const RepoStickyHeader: React.FC<RepoStickyHeaderProps> = ({
  repoName,
  isLocal,
}) => {
  const Icon = isLocal ? HardDrive : GitBranch;
  const iconColor = isLocal ? "text-green-500" : "text-blue-500";

  return (
    <div
      className="sticky top-0 z-20 flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border-b border-border/50"
    >
      <Icon size={16} className={iconColor} />
      <span className="text-sm font-semibold text-foreground">{repoName}</span>
    </div>
  );
};

/**
 * 命名空间 Sub Header
 */
interface NamespaceSubHeaderProps {
  namespaceName: string;
  indent?: boolean;
}

const NamespaceSubHeader: React.FC<NamespaceSubHeaderProps> = ({
  namespaceName,
  indent = false,
}) => {
  return (
    <div
      className={cn(
        "sticky top-10 z-10 flex items-center gap-2 px-3 py-1.5 bg-muted/50 backdrop-blur-sm",
        indent && "ml-4",
      )}
    >
      <Folder size={14} className="text-yellow-500" />
      <span className="text-xs font-medium text-muted-foreground">
        {namespaceName}
      </span>
    </div>
  );
};

/**
 * 空状态组件
 */
interface EmptyStateProps {
  type: "all" | "repo" | "namespace" | "search";
}

const EmptyState: React.FC<EmptyStateProps> = ({ type }) => {
  const { t } = useTranslation();

  const messages: Record<string, { title: string; description: string }> = {
    all: {
      title: t("agents.noInstalled", "No agents installed"),
      description: t(
        "agents.noInstalledDescription",
        "Use the Discover button to find and install agents",
      ),
    },
    repo: {
      title: t("agents.emptyRepo", "No agents in this repository"),
      description: t(
        "agents.emptyRepoDescription",
        "This repository doesn't have any installed agents",
      ),
    },
    namespace: {
      title: t("agents.noAgentsInNamespace", "No agents in this namespace"),
      description: t(
        "agents.emptyNamespaceDescription",
        "This namespace doesn't have any agents",
      ),
    },
    search: {
      title: t("agents.noSearchResults", "No agents found"),
      description: t(
        "agents.noSearchResultsDescription",
        "Try a different search term",
      ),
    },
  };

  const message = messages[type] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Bot size={48} className="text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">
        {message.title}
      </h3>
      <p className="text-sm text-muted-foreground/70 mt-1">
        {message.description}
      </p>
    </div>
  );
};

export default GroupedAgentsList;
