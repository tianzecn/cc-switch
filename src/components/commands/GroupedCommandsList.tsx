import React, { useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, HardDrive, Folder, Terminal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandListItem } from "./CommandListItem";
import type { InstalledCommand, AppType } from "@/hooks/useCommands";
import type { TreeSelection } from "@/types/tree";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/** 分组后的数据结构 */
interface GroupedData {
  repoId: string;
  repoName: string;
  isLocal: boolean;
  namespaces: Array<{
    namespaceId: string;
    namespaceName: string;
    commands: InstalledCommand[];
  }>;
}

interface GroupedCommandsListProps {
  commands: InstalledCommand[];
  selection: TreeSelection;
  selectedCommandId: string | null;
  onSelectCommand: (command: InstalledCommand | null) => void;
  onToggleApp: (commandId: string, app: AppType, enabled: boolean) => void;
  onUninstall: (commandId: string) => void;
  onOpenEditor: (commandId: string) => void;
  appSupport: {
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
 * 分组 Commands 列表组件
 * 根据选中状态决定分组方式：
 * - all: 按 仓库→命名空间 完整层级分组
 * - repo: 按命名空间分组
 * - namespace: 不分组，直接显示
 */
export const GroupedCommandsList: React.FC<GroupedCommandsListProps> = ({
  commands,
  selection,
  selectedCommandId,
  onSelectCommand,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  appSupport,
  isLoading = false,
  pageSize = 50,
  emptyStateType = "all",
}) => {
  const { t } = useTranslation();
  const [displayCount, setDisplayCount] = React.useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // 构建分组数据
  const groupedData = useMemo((): GroupedData[] => {
    if (commands.length === 0) return [];

    // 按仓库分组
    const repoMap = new Map<string, Map<string, InstalledCommand[]>>();

    for (const cmd of commands) {
      const repoKey =
        cmd.repoOwner && cmd.repoName
          ? `${cmd.repoOwner}/${cmd.repoName}`
          : "local";
      const namespace = cmd.namespace || "";

      if (!repoMap.has(repoKey)) {
        repoMap.set(repoKey, new Map());
      }

      const nsMap = repoMap.get(repoKey)!;
      if (!nsMap.has(namespace)) {
        nsMap.set(namespace, []);
      }

      nsMap.get(namespace)!.push(cmd);
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

      const namespaces = sortedNs.map(([ns, nsCommands]) => ({
        namespaceId: `${repoKey}/${ns}`,
        namespaceName: ns || t("commands.rootNamespace", "Root"),
        commands: nsCommands.sort((a, b) => a.name.localeCompare(b.name)),
      }));

      result.push({
        repoId: repoKey,
        repoName: isLocal ? t("commands.localCommands", "Local Commands") : repoKey,
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
  }, [commands, t]);

  // 是否有更多数据
  const hasMore = displayCount < commands.length;
  const remainingCount = commands.length - displayCount;

  // 加载更多
  const handleLoadMore = useCallback(() => {
    setDisplayCount((prev) => Math.min(prev + pageSize, commands.length));
  }, [pageSize, commands.length]);

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

  // 重置分页当 commands 变化
  React.useEffect(() => {
    setDisplayCount(pageSize);
  }, [commands, pageSize]);

  // 根据选中状态决定渲染方式
  const shouldShowRepoHeaders = selection.type === "all";
  const shouldShowNamespaceHeaders = selection.type === "all" || selection.type === "repo";

  // 计算当前显示的分组数据（考虑分页）- 必须在条件返回之前调用
  const displayedGroupData = useMemo(() => {
    let count = 0;
    const result: GroupedData[] = [];

    for (const repo of groupedData) {
      const displayedNamespaces = [];

      for (const ns of repo.namespaces) {
        const remainingSlots = displayCount - count;
        if (remainingSlots <= 0) break;

        const displayedCommands = ns.commands.slice(0, remainingSlots);
        count += displayedCommands.length;

        if (displayedCommands.length > 0) {
          displayedNamespaces.push({
            ...ns,
            commands: displayedCommands,
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

  // 条件返回 - 必须在所有 Hooks 之后
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (commands.length === 0) {
    return <EmptyState type={emptyStateType} />;
  }

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

              {/* Commands 列表 */}
              <div className={cn("space-y-2", shouldShowNamespaceHeaders && "mt-2")}>
                {ns.commands.map((cmd) => (
                  <CommandListItem
                    key={cmd.id}
                    command={cmd}
                    isSelected={selectedCommandId === cmd.id}
                    onSelect={() =>
                      onSelectCommand(selectedCommandId === cmd.id ? null : cmd)
                    }
                    onToggleApp={(app, enabled) =>
                      onToggleApp(cmd.id, app, enabled)
                    }
                    onUninstall={() => onUninstall(cmd.id)}
                    onOpenEditor={() => onOpenEditor(cmd.id)}
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
      title: t("commands.noInstalled", "No commands installed"),
      description: t(
        "commands.noInstalledDescription",
        "Use the Discover button to find and install commands",
      ),
    },
    repo: {
      title: t("commands.emptyRepo", "No commands in this repository"),
      description: t(
        "commands.emptyRepoDescription",
        "This repository doesn't have any installed commands",
      ),
    },
    namespace: {
      title: t("commands.noCommandsInNamespace", "No commands in this namespace"),
      description: t(
        "commands.emptyNamespaceDescription",
        "This namespace doesn't have any commands",
      ),
    },
    search: {
      title: t("commands.noSearchResults", "No commands found"),
      description: t(
        "commands.noSearchResultsDescription",
        "Try a different search term",
      ),
    },
  };

  const message = messages[type] || messages.all;

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Terminal size={48} className="text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium text-muted-foreground">
        {message.title}
      </h3>
      <p className="text-sm text-muted-foreground/70 mt-1">
        {message.description}
      </p>
    </div>
  );
};

export default GroupedCommandsList;
