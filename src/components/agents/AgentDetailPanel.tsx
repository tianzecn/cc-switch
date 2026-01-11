import React from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  FileEdit,
  ExternalLink,
  Tag,
  AlertCircle,
  GitBranch,
  HardDrive,
  Calendar,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  useAgentContent,
  useAppAgentsSupport,
  type InstalledAgent,
} from "@/hooks/useAgents";
import { settingsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatInstallTime } from "@/lib/utils/date";

interface AgentDetailPanelProps {
  agent: InstalledAgent;
  onClose: () => void;
  onOpenEditor: () => void;
}

/**
 * Agent 详情面板
 * 显示完整元数据和配置内容预览
 */
export const AgentDetailPanel: React.FC<AgentDetailPanelProps> = ({
  agent,
  onClose,
  onOpenEditor,
}) => {
  const { t } = useTranslation();
  const { data: content, isLoading: isLoadingContent } = useAgentContent(
    agent.id,
  );

  // 检查各应用的支持状态
  const { data: claudeSupported = true } = useAppAgentsSupport("claude");
  const { data: codexSupported = false } = useAppAgentsSupport("codex");
  const { data: geminiSupported = false } = useAppAgentsSupport("gemini");

  const isLocal = !agent.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;

  const handleOpenDocs = async () => {
    if (!agent.readmeUrl) return;
    try {
      await settingsApi.openExternal(agent.readmeUrl);
    } catch {
      // ignore
    }
  };

  // 生成来源标签
  const sourceLabel = React.useMemo(() => {
    if (agent.repoOwner && agent.repoName) {
      return `${agent.repoOwner}/${agent.repoName}`;
    }
    return t("agents.local");
  }, [agent.repoOwner, agent.repoName, t]);

  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground truncate">{agent.id}</h3>
        <div className="flex items-center gap-1">
          {agent.readmeUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenDocs}
              title={t("agents.viewDocs")}
            >
              <ExternalLink size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenEditor}
            title={t("agents.openInEditor")}
          >
            <FileEdit size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Description */}
          {agent.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t("agents.description")}
              </h4>
              <p className="text-sm text-foreground">{agent.description}</p>
            </div>
          )}

          {/* Source */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <SourceIcon size={12} />
              {t("agents.source")}
            </h4>
            <Badge variant="outline" className="text-xs">
              {sourceLabel}
            </Badge>
          </div>

          {/* Namespace */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Folder size={12} />
              {t("agents.namespace")}
            </h4>
            <span className="text-sm">
              {agent.namespace || t("agents.rootNamespace")}
            </span>
          </div>

          {/* Model */}
          {agent.model && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Tag size={12} />
                {t("agents.model")}
              </h4>
              <Badge variant="outline" className="text-xs">
                {agent.model}
              </Badge>
            </div>
          )}

          {/* Tools */}
          {agent.tools && agent.tools.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t("agents.tools")}
              </h4>
              <div className="flex flex-wrap gap-1">
                {agent.tools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-block px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* App Status */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {t("agents.enabledApps")}
            </h4>
            <div className="space-y-1.5 text-sm">
              {/* Claude */}
              <AppStatusRow
                appName={t("agents.apps.claude")}
                isEnabled={agent.apps.claude}
                isSupported={claudeSupported}
                unsupportedLabel={t("agents.appUnsupported")}
              />
              {/* Codex */}
              <AppStatusRow
                appName={t("agents.apps.codex")}
                isEnabled={agent.apps.codex}
                isSupported={codexSupported}
                unsupportedLabel={t("agents.appUnsupported")}
              />
              {/* Gemini */}
              <AppStatusRow
                appName={t("agents.apps.gemini")}
                isEnabled={agent.apps.gemini}
                isSupported={geminiSupported}
                unsupportedLabel={t("agents.appUnsupported")}
              />
            </div>
          </div>

          {/* Installed At */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Calendar size={12} />
              {t("agents.installedAt")}
            </h4>
            <p className="text-sm text-foreground">
              {formatInstallTime(agent.installedAt)}
            </p>
          </div>

          <Separator />

          {/* Content Preview */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {t("agents.contentPreview")}
            </h4>
            {isLoadingContent ? (
              <div className="text-sm text-muted-foreground">
                {t("agents.loadingContent")}
              </div>
            ) : content ? (
              <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64">
                {content}
              </pre>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("agents.noContent")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 应用状态行组件
 */
interface AppStatusRowProps {
  appName: string;
  isEnabled: boolean;
  isSupported: boolean;
  unsupportedLabel: string;
}

const AppStatusRow: React.FC<AppStatusRowProps> = ({
  appName,
  isEnabled,
  isSupported,
  unsupportedLabel,
}) => {
  if (!isSupported) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">{appName}</span>
        <span className="flex items-center gap-1 text-xs text-yellow-500">
          <AlertCircle size={12} />
          {unsupportedLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <span>{appName}</span>
      <span
        className={cn(isEnabled ? "text-green-500" : "text-muted-foreground")}
      >
        {isEnabled ? "●" : "○"}
      </span>
    </div>
  );
};

export default AgentDetailPanel;
