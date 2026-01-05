import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  RefreshCw,
  FileEdit,
  FileX,
  FilePlus,
  GitCompare,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCommandChanges,
  useResolveConflict,
  type ChangeEvent,
  type ChangeEventType,
  type ConflictResolution,
} from "@/hooks/useCommands";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ConflictDetectionPanelProps {
  className?: string;
}

/**
 * 冲突检测面板
 * 检测 SSOT 与应用目录之间的变更，并提供解决冲突的选项
 */
export const ConflictDetectionPanel: React.FC<ConflictDetectionPanelProps> = ({
  className,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: changes, isLoading, isFetching, refetch } = useCommandChanges();
  const resolveMutation = useResolveConflict();

  const handleDetect = async () => {
    try {
      await refetch();
      toast.success(t("commands.conflict.detectComplete"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleResolve = async (
    id: string,
    app: string,
    resolution: ConflictResolution
  ) => {
    try {
      await resolveMutation.mutateAsync({
        id,
        app: app as "claude" | "codex" | "gemini",
        resolution,
      });
      toast.success(t("commands.conflict.resolveSuccess"), { closeButton: true });
      // 重新检测
      await refetch();
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const hasChanges = changes && changes.length > 0;
  const conflictCount = changes?.filter((c) => c.eventType === "appConflict").length || 0;

  return (
    <div className={cn("glass rounded-xl border border-white/10", className)}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              hasChanges
                ? "bg-yellow-500/20 text-yellow-500"
                : "bg-green-500/20 text-green-500"
            )}
          >
            {hasChanges ? <AlertTriangle size={16} /> : <Check size={16} />}
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {t("commands.conflict.title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {hasChanges
                ? t("commands.conflict.hasChanges", { count: changes.length })
                : t("commands.conflict.noChanges")}
              {conflictCount > 0 && (
                <span className="ml-2 text-yellow-500">
                  ({t("commands.conflict.conflictCount", { count: conflictCount })})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDetect();
            }}
            disabled={isLoading || isFetching}
          >
            <RefreshCw
              size={14}
              className={isFetching ? "animate-spin" : ""}
            />
            <span className="ml-1">{t("commands.conflict.detect")}</span>
          </Button>
          {hasChanges && (
            isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
          )}
        </div>
      </div>

      {/* Changes List */}
      {isExpanded && hasChanges && (
        <div className="border-t border-white/10 px-4 py-3 space-y-2">
          {changes.map((change) => (
            <ChangeEventCard
              key={`${change.id}-${change.app || "ssot"}`}
              change={change}
              onResolve={handleResolve}
              isResolving={resolveMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 变更事件卡片
 */
interface ChangeEventCardProps {
  change: ChangeEvent;
  onResolve: (id: string, app: string, resolution: ConflictResolution) => void;
  isResolving: boolean;
}

const ChangeEventCard: React.FC<ChangeEventCardProps> = ({
  change,
  onResolve,
  isResolving,
}) => {
  const { t } = useTranslation();

  const getEventIcon = (type: ChangeEventType) => {
    switch (type) {
      case "ssotModified":
        return <FileEdit size={16} className="text-blue-500" />;
      case "ssotDeleted":
        return <FileX size={16} className="text-red-500" />;
      case "ssotAdded":
        return <FilePlus size={16} className="text-green-500" />;
      case "appConflict":
        return <GitCompare size={16} className="text-yellow-500" />;
    }
  };

  const getEventLabel = (type: ChangeEventType) => {
    switch (type) {
      case "ssotModified":
        return t("commands.conflict.types.ssotModified");
      case "ssotDeleted":
        return t("commands.conflict.types.ssotDeleted");
      case "ssotAdded":
        return t("commands.conflict.types.ssotAdded");
      case "appConflict":
        return t("commands.conflict.types.appConflict");
    }
  };

  const isConflict = change.eventType === "appConflict";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        isConflict
          ? "border-yellow-500/30 bg-yellow-500/5"
          : "border-border bg-muted/50"
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getEventIcon(change.eventType)}</div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground text-sm">{change.id}</span>
          <span className="px-1.5 py-0.5 text-xs rounded bg-muted text-muted-foreground">
            {getEventLabel(change.eventType)}
          </span>
        </div>
        {change.app && (
          <p className="text-xs text-muted-foreground">
            {t("commands.conflict.affectedApp")}: {change.app}
          </p>
        )}
        {change.details && (
          <p className="text-xs text-muted-foreground mt-1">{change.details}</p>
        )}
      </div>

      {/* Actions for Conflicts */}
      {isConflict && change.app && (
        <div className="flex-shrink-0 flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve(change.id, change.app!, "keepSsot")}
            disabled={isResolving}
            className="text-xs h-7 px-2"
            title={t("commands.conflict.keepSsot")}
          >
            {isResolving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}
            <span className="ml-1">SSOT</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onResolve(change.id, change.app!, "keepApp")}
            disabled={isResolving}
            className="text-xs h-7 px-2"
            title={t("commands.conflict.keepApp")}
          >
            {isResolving ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <X size={12} />
            )}
            <span className="ml-1">{change.app}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default ConflictDetectionPanel;
