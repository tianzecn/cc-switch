import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Search,
  FileUp,
  Check,
  Loader2,
  FolderSearch,
  Square,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useScanUnmanagedAgents,
  useImportAgentsFromApps,
  type UnmanagedAgent,
} from "@/hooks/useAgents";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AgentImportProps {
  onBack: () => void;
}

/**
 * 未管理 Agents 导入页面
 * 扫描应用目录中未被 SSOT 管理的 Agents，并支持批量导入
 */
export const AgentImport: React.FC<AgentImportProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Queries
  const { data: unmanagedAgents, isLoading, refetch, isFetching } =
    useScanUnmanagedAgents();
  const importMutation = useImportAgentsFromApps();

  // 筛选 Agents
  const filteredAgents = useMemo(() => {
    if (!unmanagedAgents) return [];

    if (!searchQuery) return unmanagedAgents;

    const query = searchQuery.toLowerCase();
    return unmanagedAgents.filter((agent) => {
      const matchesName = agent.name.toLowerCase().includes(query);
      const matchesDesc = agent.description?.toLowerCase().includes(query);
      const matchesId = agent.id.toLowerCase().includes(query);
      return matchesName || matchesDesc || matchesId;
    });
  }, [unmanagedAgents, searchQuery]);

  const handleScan = async () => {
    try {
      await refetch();
      toast.success(t("agents.scanComplete"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredAgents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAgents.map((agent) => agent.id)));
    }
  };

  const handleImport = async () => {
    if (selectedIds.size === 0) {
      toast.error(t("agents.noAgentsSelected"));
      return;
    }

    try {
      const ids = Array.from(selectedIds);
      const imported = await importMutation.mutateAsync(ids);
      toast.success(
        t("agents.importSuccess", { count: imported.length }),
        { closeButton: true }
      );
      setSelectedIds(new Set());
      await refetch();
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const isAllSelected =
    filteredAgents.length > 0 &&
    selectedIds.size === filteredAgents.length;

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {t("agents.importTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("agents.importSubtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={isFetching}
        >
          <FolderSearch
            size={16}
            className={isFetching ? "animate-pulse" : ""}
          />
          <span className="ml-2">{t("agents.scan")}</span>
        </Button>
      </div>

      {/* Search and Actions */}
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

        {filteredAgents.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="gap-1"
            >
              {isAllSelected ? (
                <CheckSquare size={16} />
              ) : (
                <Square size={16} />
              )}
              {isAllSelected
                ? t("agents.deselectAll")
                : t("agents.selectAll")}
            </Button>

            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              className="gap-1"
            >
              {importMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <FileUp size={16} />
              )}
              {t("agents.importSelected", { count: selectedIds.size })}
            </Button>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("agents.foundUnmanaged", { count: filteredAgents.length })} ·{" "}
          {t("agents.selectedCount", { count: selectedIds.size })}
        </div>
      </div>

      {/* Agents List */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 size={24} className="animate-spin mr-2" />
            {t("agents.scanning")}
          </div>
        ) : !unmanagedAgents ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <FolderSearch size={48} className="text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t("agents.clickToScan")}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {t("agents.scanDescription")}
            </p>
            <Button variant="outline" onClick={handleScan}>
              <FolderSearch size={16} className="mr-2" />
              {t("agents.startScan")}
            </Button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Check size={48} className="text-green-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t("agents.allManaged")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t("agents.allManagedDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAgents.map((agent) => (
              <UnmanagedAgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedIds.has(agent.id)}
                onToggle={() => handleToggleSelect(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 未管理 Agent 卡片
 */
interface UnmanagedAgentCardProps {
  agent: UnmanagedAgent;
  isSelected: boolean;
  onToggle: () => void;
}

const UnmanagedAgentCard: React.FC<UnmanagedAgentCardProps> = ({
  agent,
  isSelected,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/50 hover:bg-muted"
      )}
      onClick={onToggle}
    >
      {/* Checkbox */}
      <div className="flex-shrink-0 mt-0.5">
        {isSelected ? (
          <CheckSquare size={20} className="text-primary" />
        ) : (
          <Square size={20} className="text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-foreground">{agent.id}</h3>
        </div>
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {agent.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {agent.foundIn.map((app) => (
            <span
              key={app}
              className="px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
            >
              {t(`agents.apps.${app.toLowerCase()}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentImport;
