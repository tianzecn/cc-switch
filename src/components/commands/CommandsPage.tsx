import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, Download, RefreshCw, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useInstalledCommands,
  useCommandNamespaces,
  useRefreshFromSsot,
} from "@/hooks/useCommands";
import { NamespaceTree } from "./NamespaceTree";
import { CommandsList } from "./CommandsList";
import { CommandDiscovery } from "./CommandDiscovery";
import { CommandImport } from "./CommandImport";
import { ConflictDetectionPanel } from "./ConflictDetectionPanel";
import { toast } from "sonner";

type ViewMode = "list" | "discovery" | "import";

/**
 * Commands 管理主页面
 * v3.11.0 统一管理架构：双栏布局 + 三应用开关
 */
export const CommandsPage: React.FC = () => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null
  );

  // Queries
  const { data: commands, isLoading } = useInstalledCommands();
  const { data: namespaces } = useCommandNamespaces();
  const refreshMutation = useRefreshFromSsot();

  // 按命名空间筛选命令
  const filteredCommands = useMemo(() => {
    if (!commands) return [];
    if (selectedNamespace === null) return commands;
    return commands.filter((cmd) => cmd.namespace === selectedNamespace);
  }, [commands, selectedNamespace]);

  // 统计各应用启用数量
  const enabledCounts = useMemo(() => {
    const counts = { claude: 0, codex: 0, gemini: 0, total: 0 };
    if (!commands) return counts;
    counts.total = commands.length;
    commands.forEach((cmd) => {
      if (cmd.apps.claude) counts.claude++;
      if (cmd.apps.codex) counts.codex++;
      if (cmd.apps.gemini) counts.gemini++;
    });
    return counts;
  }, [commands]);

  const handleRefresh = async () => {
    try {
      const count = await refreshMutation.mutateAsync();
      toast.success(t("commands.refreshSuccess", { count }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  if (viewMode === "discovery") {
    return <CommandDiscovery onBack={() => setViewMode("list")} />;
  }

  if (viewMode === "import") {
    return <CommandImport onBack={() => setViewMode("list")} />;
  }

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Terminal size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {t("commands.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("commands.subtitle")}
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
            <span className="ml-2">{t("commands.refresh")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("import")}
          >
            <FileUp size={16} />
            <span className="ml-2">{t("commands.import")}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode("discovery")}
          >
            <Download size={16} />
            <span className="ml-2">{t("commands.discover")}</span>
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("commands.installed", { count: enabledCounts.total })} ·{" "}
          {t("commands.apps.claude")}: {enabledCounts.claude} ·{" "}
          {t("commands.apps.codex")}: {enabledCounts.codex} ·{" "}
          {t("commands.apps.gemini")}: {enabledCounts.gemini}
        </div>
      </div>

      {/* Conflict Detection Panel */}
      <ConflictDetectionPanel className="flex-shrink-0 mb-4" />

      {/* Main Content - Two Column Layout */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-8">
        {/* Left Sidebar - Namespace Tree */}
        <div className="w-56 flex-shrink-0 flex flex-col overflow-hidden">
          <NamespaceTree
            namespaces={namespaces || []}
            selectedNamespace={selectedNamespace}
            onSelectNamespace={setSelectedNamespace}
          />
        </div>

        {/* Right Content - Commands List */}
        <div className="flex-1 overflow-hidden">
          <CommandsList
            commands={filteredCommands}
            isLoading={isLoading}
            selectedNamespace={selectedNamespace}
          />
        </div>
      </div>
    </div>
  );
};

export default CommandsPage;
