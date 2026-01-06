import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Trash2, ExternalLink, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useToggleAgentApp,
  useUninstallAgent,
  useOpenAgentInEditor,
  useAppAgentsSupport,
  type InstalledAgent,
  type AppType,
} from "@/hooks/useAgents";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

interface AgentsListProps {
  agents: InstalledAgent[];
  isLoading: boolean;
  selectedNamespace: string | null;
}

/**
 * Agent 列表组件
 * 显示已安装的 Agents，支持应用开关切换
 */
export const AgentsList: React.FC<AgentsListProps> = ({
  agents,
  isLoading,
  selectedNamespace,
}) => {
  const { t } = useTranslation();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleAppMutation = useToggleAgentApp();
  const uninstallMutation = useUninstallAgent();
  const openEditorMutation = useOpenAgentInEditor();

  // 检查各应用的 Agents 支持状态
  const { data: claudeSupported = true } = useAppAgentsSupport("claude");
  const { data: codexSupported = false } = useAppAgentsSupport("codex");
  const { data: geminiSupported = false } = useAppAgentsSupport("gemini");

  const handleToggleApp = async (
    id: string,
    app: AppType,
    enabled: boolean,
  ) => {
    try {
      await toggleAppMutation.mutateAsync({ id, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleUninstall = (agent: InstalledAgent) => {
    setConfirmDialog({
      isOpen: true,
      title: t("agents.uninstall"),
      message: t("agents.uninstallConfirm", { name: agent.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(agent.id);
          setConfirmDialog(null);
          toast.success(t("agents.uninstallSuccess", { name: agent.name }), {
            closeButton: true,
          });
        } catch (error) {
          toast.error(t("common.error"), {
            description: String(error),
          });
        }
      },
    });
  };

  const handleOpenEditor = async (agent: InstalledAgent) => {
    try {
      await openEditorMutation.mutateAsync(agent.id);
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleOpenDocs = async (url: string) => {
    try {
      await settingsApi.openExternal(url);
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        {t("agents.loading")}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Bot size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {selectedNamespace !== null
            ? t("agents.noAgentsInNamespace")
            : t("agents.noInstalled")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("agents.noInstalledDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Agents List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {agents.map((agent) => (
          <AgentListItem
            key={agent.id}
            agent={agent}
            onToggleApp={handleToggleApp}
            onUninstall={() => handleUninstall(agent)}
            onOpenEditor={() => handleOpenEditor(agent)}
            onOpenDocs={
              agent.readmeUrl
                ? () => handleOpenDocs(agent.readmeUrl!)
                : undefined
            }
            appSupport={{
              claude: claudeSupported,
              codex: codexSupported,
              gemini: geminiSupported,
            }}
          />
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

/**
 * Agent 列表项组件
 */
interface AgentListItemProps {
  agent: InstalledAgent;
  onToggleApp: (id: string, app: AppType, enabled: boolean) => void;
  onUninstall: () => void;
  onOpenEditor: () => void;
  onOpenDocs?: () => void;
  appSupport: {
    claude: boolean;
    codex: boolean;
    gemini: boolean;
  };
}

const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  onOpenDocs,
  appSupport,
}) => {
  const { t } = useTranslation();

  // 生成来源标签
  const sourceLabel = useMemo(() => {
    if (agent.repoOwner && agent.repoName) {
      return `${agent.repoOwner}/${agent.repoName}`;
    }
    return t("agents.local");
  }, [agent.repoOwner, agent.repoName, t]);

  return (
    <div className="group relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 border-border-default bg-muted/50 hover:bg-muted hover:border-border-default/80 hover:shadow-sm">
      {/* 左侧：Agent 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-foreground">{agent.id}</h3>
          {onOpenDocs && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDocs();
              }}
              className="h-6 px-2"
            >
              <ExternalLink size={14} />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor();
            }}
            className="h-6 px-2"
            title={t("agents.openInEditor")}
          >
            <FileEdit size={14} />
          </Button>
        </div>
        {agent.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
        )}
        <p className="text-xs text-muted-foreground/70 mt-1">{sourceLabel}</p>
      </div>

      {/* 中间：应用开关 */}
      <div
        className="flex flex-col gap-2 flex-shrink-0 min-w-[120px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${agent.id}-claude`}
            className={`text-sm cursor-pointer ${
              appSupport.claude ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("agents.apps.claude")}
          </label>
          <Switch
            id={`${agent.id}-claude`}
            checked={agent.apps.claude}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(agent.id, "claude", checked)
            }
            disabled={!appSupport.claude}
            title={!appSupport.claude ? t("agents.appUnsupported") : undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${agent.id}-codex`}
            className={`text-sm cursor-pointer ${
              appSupport.codex ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("agents.apps.codex")}
          </label>
          <Switch
            id={`${agent.id}-codex`}
            checked={agent.apps.codex}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(agent.id, "codex", checked)
            }
            disabled={!appSupport.codex}
            title={!appSupport.codex ? t("agents.appUnsupported") : undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${agent.id}-gemini`}
            className={`text-sm cursor-pointer ${
              appSupport.gemini ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("agents.apps.gemini")}
          </label>
          <Switch
            id={`${agent.id}-gemini`}
            checked={agent.apps.gemini}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(agent.id, "gemini", checked)
            }
            disabled={!appSupport.gemini}
            title={!appSupport.gemini ? t("agents.appUnsupported") : undefined}
          />
        </div>
      </div>

      {/* 右侧：删除按钮 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            onUninstall();
          }}
          className="hover:text-red-500 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/10"
          title={t("agents.uninstall")}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

export default AgentsList;
