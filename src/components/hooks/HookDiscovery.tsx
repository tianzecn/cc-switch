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
  Webhook,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useDiscoverableHooks,
  useInstalledHooks,
  useInstallHook,
  useHookRepos,
  useAddHookRepo,
  useRemoveHookRepo,
  useRefreshDiscoverableHooks,
  type DiscoverableHook,
  type CommandRepo,
  type HookEventType,
} from "@/hooks/useHooks";
import { toast } from "sonner";
import { ContentContainer } from "@/components/layout";
import { CommandRepoManager } from "@/components/commands/CommandRepoManager";
import { HookDiscoveryTree } from "./HookDiscoveryTree";

interface HookDiscoveryProps {
  onBack: () => void;
}

// 事件类型对应的颜色
const EVENT_TYPE_COLORS: Record<HookEventType, string> = {
  PreToolUse: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PostToolUse: "bg-green-500/10 text-green-600 dark:text-green-400",
  PermissionRequest: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  SessionEnd: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

/**
 * Hook 发现页面（双栏布局）
 * 左侧：树形结构浏览（repo → namespace → hooks）
 * 右侧：Hook 详情面板
 */
export const HookDiscovery: React.FC<HookDiscoveryProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null,
  );
  const [namespaceHooks, setNamespaceHooks] = useState<DiscoverableHook[]>([]);

  // Queries
  const { data: discoverableHooks, isLoading } = useDiscoverableHooks();
  const { data: installedHooks } = useInstalledHooks();
  const { data: repos = [] } = useHookRepos();
  const installMutation = useInstallHook();
  const addRepoMutation = useAddHookRepo();
  const removeRepoMutation = useRemoveHookRepo();
  const refreshMutation = useRefreshDiscoverableHooks();

  // 已安装的 Hook ID 集合
  const installedIds = useMemo(() => {
    if (!installedHooks) return new Set<string>();
    return new Set(installedHooks.map((hook) => hook.id));
  }, [installedHooks]);

  // 筛选 Hooks
  const filteredHooks = useMemo(() => {
    if (!discoverableHooks) return [];

    return discoverableHooks.filter((hook) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = hook.name.toLowerCase().includes(query);
        const matchesDesc = hook.description?.toLowerCase().includes(query);
        const matchesKey = hook.key.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesKey) return false;
      }
      return true;
    });
  }, [discoverableHooks, searchQuery]);

  const handleInstall = async (hook: DiscoverableHook) => {
    try {
      await installMutation.mutateAsync({
        hook,
        currentApp: "claude",
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

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      toast.success(t("hooks.refreshSuccess"), { closeButton: true });
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

  const handleSelectNamespace = (
    namespaceId: string,
    hooks: DiscoverableHook[],
  ) => {
    setSelectedNamespace(namespaceId);
    setNamespaceHooks(hooks);
  };

  const isHookInstalled = (hook: DiscoverableHook) => {
    const id = hook.namespace
      ? `${hook.namespace}/${hook.filename}`
      : hook.filename;
    return installedIds.has(id);
  };

  return (
    <ContentContainer variant="wide" className="flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {t("hooks.discoverTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("hooks.discoverSubtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRepoManager(true)}
        >
          <Settings size={16} />
          <span className="ml-2">{t("hooks.repo.manage")}</span>
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
            placeholder={t("hooks.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("hooks.available", { count: filteredHooks.length })} ·{" "}
          {t("hooks.installedCount", { count: installedIds.size })}
        </div>
      </div>

      {/* Main Content - 双栏布局 */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-4">
        {/* Left Panel - Tree Navigation */}
        <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("hooks.browseByRepo")}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Loader2 size={20} className="animate-spin mr-2" />
                {t("hooks.loadingDiscoverable")}
              </div>
            ) : (
              <HookDiscoveryTree
                hooks={filteredHooks}
                selectedNamespace={selectedNamespace}
                onSelectNamespace={handleSelectNamespace}
                expandedNodes={expandedNodes}
                onToggleNode={handleToggleNode}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Hook List */}
        <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          {selectedNamespace ? (
            <>
              <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
                <h3 className="text-sm font-medium text-foreground">
                  {selectedNamespace.split("/").slice(-1)[0]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {namespaceHooks.length} {t("hooks.title").toLowerCase()}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-2">
                  {namespaceHooks.map((hook) => (
                    <HookListItem
                      key={hook.key}
                      hook={hook}
                      isInstalled={isHookInstalled(hook)}
                      isInstalling={
                        installMutation.isPending &&
                        installMutation.variables?.hook.key === hook.key
                      }
                      onInstall={() => handleInstall(hook)}
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
 * Hook 列表项组件
 */
interface HookListItemProps {
  hook: DiscoverableHook;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const HookListItem: React.FC<HookListItemProps> = ({
  hook,
  isInstalled,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();

  return (
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
              onClick={onInstall}
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
  );
};

export default HookDiscovery;
