import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, Trash2, ExternalLink, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  useToggleCommandApp,
  useUninstallCommand,
  useOpenCommandInEditor,
  useAppCommandsSupport,
  type InstalledCommand,
  type AppType,
} from "@/hooks/useCommands";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";
import { CommandDetailPanel } from "./CommandDetailPanel";

interface CommandsListProps {
  commands: InstalledCommand[];
  isLoading: boolean;
  selectedNamespace: string | null;
}

/**
 * 命令列表组件
 * 显示已安装的 Commands，支持应用开关切换
 */
export const CommandsList: React.FC<CommandsListProps> = ({
  commands,
  isLoading,
  selectedNamespace,
}) => {
  const { t } = useTranslation();
  const [selectedCommand, setSelectedCommand] =
    useState<InstalledCommand | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleAppMutation = useToggleCommandApp();
  const uninstallMutation = useUninstallCommand();
  const openEditorMutation = useOpenCommandInEditor();

  // 检查各应用的 Commands 支持状态
  const { data: claudeSupported = true } = useAppCommandsSupport("claude");
  const { data: codexSupported = false } = useAppCommandsSupport("codex");
  const { data: geminiSupported = false } = useAppCommandsSupport("gemini");

  const handleToggleApp = async (
    id: string,
    app: AppType,
    enabled: boolean
  ) => {
    try {
      await toggleAppMutation.mutateAsync({ id, app, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleUninstall = (command: InstalledCommand) => {
    setConfirmDialog({
      isOpen: true,
      title: t("commands.uninstall"),
      message: t("commands.uninstallConfirm", { name: command.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(command.id);
          setConfirmDialog(null);
          if (selectedCommand?.id === command.id) {
            setSelectedCommand(null);
          }
          toast.success(t("commands.uninstallSuccess", { name: command.name }), {
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

  const handleOpenEditor = async (command: InstalledCommand) => {
    try {
      await openEditorMutation.mutateAsync(command.id);
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
        {t("commands.loading")}
      </div>
    );
  }

  if (commands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Terminal size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {selectedNamespace !== null
            ? t("commands.noCommandsInNamespace")
            : t("commands.noInstalled")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("commands.noInstalledDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Commands List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {commands.map((command) => (
          <CommandListItem
            key={command.id}
            command={command}
            isSelected={selectedCommand?.id === command.id}
            onSelect={() => setSelectedCommand(command)}
            onToggleApp={handleToggleApp}
            onUninstall={() => handleUninstall(command)}
            onOpenEditor={() => handleOpenEditor(command)}
            onOpenDocs={command.readmeUrl ? () => handleOpenDocs(command.readmeUrl!) : undefined}
            appSupport={{
              claude: claudeSupported,
              codex: codexSupported,
              gemini: geminiSupported,
            }}
          />
        ))}
      </div>

      {/* Detail Panel */}
      {selectedCommand && (
        <div className="w-80 flex-shrink-0 overflow-hidden">
          <CommandDetailPanel
            command={selectedCommand}
            onClose={() => setSelectedCommand(null)}
            onOpenEditor={() => handleOpenEditor(selectedCommand)}
          />
        </div>
      )}

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
 * 命令列表项组件
 */
interface CommandListItemProps {
  command: InstalledCommand;
  isSelected: boolean;
  onSelect: () => void;
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

const CommandListItem: React.FC<CommandListItemProps> = ({
  command,
  isSelected,
  onSelect,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  onOpenDocs,
  appSupport,
}) => {
  const { t } = useTranslation();

  // 生成来源标签
  const sourceLabel = useMemo(() => {
    if (command.repoOwner && command.repoName) {
      return `${command.repoOwner}/${command.repoName}`;
    }
    return t("commands.local");
  }, [command.repoOwner, command.repoName, t]);

  return (
    <div
      className={`group relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border-default bg-muted/50 hover:bg-muted hover:border-border-default/80 hover:shadow-sm"
      }`}
      onClick={onSelect}
    >
      {/* 左侧：Command 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-foreground">{command.id}</h3>
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
            title={t("commands.openInEditor")}
          >
            <FileEdit size={14} />
          </Button>
        </div>
        {command.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {command.description}
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
            htmlFor={`${command.id}-claude`}
            className={`text-sm cursor-pointer ${
              appSupport.claude ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("commands.apps.claude")}
          </label>
          <Switch
            id={`${command.id}-claude`}
            checked={command.apps.claude}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(command.id, "claude", checked)
            }
            disabled={!appSupport.claude}
            title={!appSupport.claude ? t("commands.appUnsupported") : undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${command.id}-codex`}
            className={`text-sm cursor-pointer ${
              appSupport.codex ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("commands.apps.codex")}
          </label>
          <Switch
            id={`${command.id}-codex`}
            checked={command.apps.codex}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(command.id, "codex", checked)
            }
            disabled={!appSupport.codex}
            title={!appSupport.codex ? t("commands.appUnsupported") : undefined}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${command.id}-gemini`}
            className={`text-sm cursor-pointer ${
              appSupport.gemini ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            {t("commands.apps.gemini")}
          </label>
          <Switch
            id={`${command.id}-gemini`}
            checked={command.apps.gemini}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(command.id, "gemini", checked)
            }
            disabled={!appSupport.gemini}
            title={!appSupport.gemini ? t("commands.appUnsupported") : undefined}
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
          title={t("commands.uninstall")}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>
  );
};

export default CommandsList;
