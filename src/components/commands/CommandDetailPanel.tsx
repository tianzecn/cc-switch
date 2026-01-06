import React from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  FileEdit,
  ExternalLink,
  Tag,
  Server,
  User,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCommandContent,
  useAppCommandsSupport,
  type InstalledCommand,
} from "@/hooks/useCommands";
import { settingsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface CommandDetailPanelProps {
  command: InstalledCommand;
  onClose: () => void;
  onOpenEditor: () => void;
}

/**
 * 命令详情面板
 * 显示完整元数据和 Markdown 内容预览
 */
export const CommandDetailPanel: React.FC<CommandDetailPanelProps> = ({
  command,
  onClose,
  onOpenEditor,
}) => {
  const { t } = useTranslation();
  const { data: content, isLoading: isLoadingContent } = useCommandContent(
    command.id,
  );

  // 检查各应用的支持状态
  const { data: claudeSupported = true } = useAppCommandsSupport("claude");
  const { data: codexSupported = false } = useAppCommandsSupport("codex");
  const { data: geminiSupported = false } = useAppCommandsSupport("gemini");

  const handleOpenDocs = async () => {
    if (!command.readmeUrl) return;
    try {
      await settingsApi.openExternal(command.readmeUrl);
    } catch {
      // ignore
    }
  };

  // 生成来源标签
  const sourceLabel = React.useMemo(() => {
    if (command.repoOwner && command.repoName) {
      return `${command.repoOwner}/${command.repoName}`;
    }
    return t("commands.local");
  }, [command.repoOwner, command.repoName, t]);

  return (
    <div className="h-full flex flex-col rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-foreground truncate">{command.id}</h3>
        <div className="flex items-center gap-1">
          {command.readmeUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenDocs}
              title={t("commands.viewDocs")}
            >
              <ExternalLink size={14} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenEditor}
            title={t("commands.openInEditor")}
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
          {command.description && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t("commands.description")}
              </h4>
              <p className="text-sm text-foreground">{command.description}</p>
            </div>
          )}

          {/* Source */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              {t("commands.source")}
            </h4>
            <p className="text-sm text-foreground">{sourceLabel}</p>
          </div>

          {/* Category */}
          {command.category && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Tag size={12} />
                {t("commands.category")}
              </h4>
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                {command.category}
              </span>
            </div>
          )}

          {/* Allowed Tools */}
          {command.allowedTools && command.allowedTools.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">
                {t("commands.allowedTools")}
              </h4>
              <div className="flex flex-wrap gap-1">
                {command.allowedTools.map((tool) => (
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

          {/* MCP Servers */}
          {command.mcpServers && command.mcpServers.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Server size={12} />
                {t("commands.mcpServers")}
              </h4>
              <div className="flex flex-wrap gap-1">
                {command.mcpServers.map((server) => (
                  <span
                    key={server}
                    className="inline-block px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                  >
                    {server}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Personas */}
          {command.personas && command.personas.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <User size={12} />
                {t("commands.personas")}
              </h4>
              <div className="flex flex-wrap gap-1">
                {command.personas.map((persona) => (
                  <span
                    key={persona}
                    className="inline-block px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
                  >
                    {persona}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* App Status */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {t("commands.enabledApps")}
            </h4>
            <div className="space-y-1.5 text-sm">
              {/* Claude */}
              <AppStatusRow
                appName={t("commands.apps.claude")}
                isEnabled={command.apps.claude}
                isSupported={claudeSupported}
                unsupportedLabel={t("commands.appUnsupported")}
              />
              {/* Codex */}
              <AppStatusRow
                appName={t("commands.apps.codex")}
                isEnabled={command.apps.codex}
                isSupported={codexSupported}
                unsupportedLabel={t("commands.appUnsupported")}
              />
              {/* Gemini */}
              <AppStatusRow
                appName={t("commands.apps.gemini")}
                isEnabled={command.apps.gemini}
                isSupported={geminiSupported}
                unsupportedLabel={t("commands.appUnsupported")}
              />
            </div>
          </div>

          {/* Installed At */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              {t("commands.installedAt")}
            </h4>
            <p className="text-sm text-foreground">
              {new Date(command.installedAt).toLocaleString()}
            </p>
          </div>

          {/* Content Preview */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {t("commands.contentPreview")}
            </h4>
            {isLoadingContent ? (
              <div className="text-sm text-muted-foreground">
                {t("commands.loadingContent")}
              </div>
            ) : content ? (
              <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-64">
                {content}
              </pre>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("commands.noContent")}
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

export default CommandDetailPanel;
