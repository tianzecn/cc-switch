import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Webhook, Download, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInstalledHooks,
  useHookNamespaces,
  useRefreshHooksFromSsot,
  useSyncHooksToApps,
  type HookEventType,
} from "@/hooks/useHooks";
import { HookNamespaceTree } from "./HookNamespaceTree";
import { HooksList } from "./HooksList";
import { HookDiscovery } from "./HookDiscovery";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
export const HooksPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null,
  );
  const [selectedEventTypes, setSelectedEventTypes] = useState<
    Set<HookEventType>
  >(new Set(EVENT_TYPES));

  // Queries
  const { data: hooks, isLoading } = useInstalledHooks();
  const { data: namespaces } = useHookNamespaces();
  const refreshMutation = useRefreshHooksFromSsot();
  const syncMutation = useSyncHooksToApps();

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

  const handleRefresh = async () => {
    try {
      const count = await refreshMutation.mutateAsync();
      toast.success(t("hooks.refreshSuccess", { count }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

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

  if (viewMode === "discovery") {
    return <HookDiscovery onBack={() => setViewMode("list")} />;
  }

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
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

        <div className="flex items-center gap-2">
          {/* Event Type Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter size={16} />
                <span className="ml-2">
                  {selectedEventTypes.size === EVENT_TYPES.length
                    ? t("hooks.allEvents")
                    : t("hooks.filteredEvents", {
                        count: selectedEventTypes.size,
                      })}
                </span>
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
              className={syncMutation.isPending ? "animate-spin" : ""}
            />
            <span className="ml-2">{t("hooks.sync")}</span>
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
            <span className="ml-2">{t("hooks.refresh")}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("discovery")}
          >
            <Download size={16} />
            <span className="ml-2">{t("hooks.discover")}</span>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("hooks.installed", { count: enabledCounts.total })} ·{" "}
          {t("hooks.enabled", { count: enabledCounts.enabled })} ·{" "}
          {t("hooks.apps.claude")}: {enabledCounts.claude} ·{" "}
          {t("hooks.apps.codex")}: {enabledCounts.codex} ·{" "}
          {t("hooks.apps.gemini")}: {enabledCounts.gemini}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
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
          />
        </div>
      </div>
    </div>
  );
};

export default HooksPage;
