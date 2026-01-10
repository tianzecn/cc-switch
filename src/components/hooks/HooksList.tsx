import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Webhook, Trash2, ExternalLink, FileEdit, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useToggleHookEnabled,
  useToggleHookApp,
  useUninstallHook,
  useOpenHookInEditor,
  useAppHooksSupport,
  type InstalledHook,
  type AppType,
  type HookEventType,
} from "@/hooks/useHooks";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";
import { ScopeBadge, createScopeFromDb, type InstallScope } from "@/components/common/ScopeBadge";
import { ScopeModifyDialog } from "@/components/common/ScopeModifyDialog";

interface HooksListProps {
  hooks: InstalledHook[];
  isLoading: boolean;
  selectedNamespace: string | null;
  /** 范围变更回调 */
  onScopeChange?: (hookId: string, newScope: InstallScope) => Promise<void>;
}

// 事件类型对应的颜色
const EVENT_TYPE_COLORS: Record<HookEventType, string> = {
  PreToolUse: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PostToolUse: "bg-green-500/10 text-green-600 dark:text-green-400",
  PermissionRequest: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  SessionEnd: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
};

/**
 * Hook 列表组件
 * 显示已安装的 Hooks，支持全局启用开关和应用开关切换
 */
export const HooksList: React.FC<HooksListProps> = ({
  hooks,
  isLoading,
  selectedNamespace,
  onScopeChange,
}) => {
  const { t } = useTranslation();
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleEnabledMutation = useToggleHookEnabled();
  const toggleAppMutation = useToggleHookApp();
  const uninstallMutation = useUninstallHook();
  const openEditorMutation = useOpenHookInEditor();

  // 检查各应用的 Hooks 支持状态
  const { data: claudeSupported = true } = useAppHooksSupport("claude");
  const { data: codexSupported = false } = useAppHooksSupport("codex");
  const { data: geminiSupported = false } = useAppHooksSupport("gemini");

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await toggleEnabledMutation.mutateAsync({ id, enabled });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

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

  const handleUninstall = (hook: InstalledHook) => {
    setConfirmDialog({
      isOpen: true,
      title: t("hooks.uninstall"),
      message: t("hooks.uninstallConfirm", { name: hook.name }),
      onConfirm: async () => {
        try {
          await uninstallMutation.mutateAsync(hook.id);
          setConfirmDialog(null);
          toast.success(t("hooks.uninstallSuccess", { name: hook.name }), {
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

  const handleOpenEditor = async (hook: InstalledHook) => {
    try {
      await openEditorMutation.mutateAsync(hook.id);
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
        {t("hooks.loading")}
      </div>
    );
  }

  if (hooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
          <Webhook size={24} className="text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {selectedNamespace !== null
            ? t("hooks.noHooksInNamespace")
            : t("hooks.noInstalled")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("hooks.noInstalledDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Hooks List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-2">
        {hooks.map((hook) => (
          <HookListItem
            key={hook.id}
            hook={hook}
            onToggleEnabled={handleToggleEnabled}
            onToggleApp={handleToggleApp}
            onUninstall={() => handleUninstall(hook)}
            onOpenEditor={() => handleOpenEditor(hook)}
            onOpenDocs={
              hook.readmeUrl ? () => handleOpenDocs(hook.readmeUrl!) : undefined
            }
            appSupport={{
              claude: claudeSupported,
              codex: codexSupported,
              gemini: geminiSupported,
            }}
            onScopeChange={onScopeChange ? (newScope) => onScopeChange(hook.id, newScope) : undefined}
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
 * Hook 列表项组件
 */
interface HookListItemProps {
  hook: InstalledHook;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onToggleApp: (id: string, app: AppType, enabled: boolean) => void;
  onUninstall: () => void;
  onOpenEditor: () => void;
  onOpenDocs?: () => void;
  appSupport: {
    claude: boolean;
    codex: boolean;
    gemini: boolean;
  };
  /** 范围变更回调 */
  onScopeChange?: (newScope: InstallScope) => Promise<void>;
}

const HookListItem: React.FC<HookListItemProps> = ({
  hook,
  onToggleEnabled,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  onOpenDocs,
  appSupport,
  onScopeChange,
}) => {
  const { t } = useTranslation();
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [isScopeChanging, setIsScopeChanging] = useState(false);

  const currentScope = createScopeFromDb(hook.scope, hook.projectPath);

  const handleScopeChange = async (newScope: InstallScope) => {
    if (!onScopeChange) return;
    setIsScopeChanging(true);
    try {
      await onScopeChange(newScope);
    } finally {
      setIsScopeChanging(false);
    }
  };

  // 生成来源标签
  const sourceLabel = useMemo(() => {
    if (hook.repoOwner && hook.repoName) {
      return `${hook.repoOwner}/${hook.repoName}`;
    }
    return t("hooks.local");
  }, [hook.repoOwner, hook.repoName, t]);

  // 生成规则摘要
  const rulesSummary = useMemo(() => {
    if (!hook.rules || hook.rules.length === 0) return "";
    const matchers = hook.rules
      .map((r) => r.matcher || "*")
      .filter((m, i, arr) => arr.indexOf(m) === i);
    return matchers.join(", ");
  }, [hook.rules]);

  return (
    <>
    <div
      className={`group relative flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all duration-300 ${
        hook.enabled
          ? "border-border-default bg-muted/50 hover:bg-muted hover:border-border-default/80"
          : "border-border-default/50 bg-muted/20 opacity-60"
      } hover:shadow-sm`}
    >
      {/* 左侧：Hook 信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {/* 全局启用开关 */}
          <div
            onClick={(e) => e.stopPropagation()}
            title={hook.enabled ? t("hooks.disable") : t("hooks.enable")}
          >
            <Button
              variant={hook.enabled ? "default" : "outline"}
              size="sm"
              className={`h-6 w-6 p-0 ${hook.enabled ? "bg-green-500 hover:bg-green-600" : ""}`}
              onClick={() => onToggleEnabled(hook.id, !hook.enabled)}
            >
              <Power size={12} />
            </Button>
          </div>

          <h3 className="font-medium text-foreground">{hook.name}</h3>

          {/* 事件类型 Badge */}
          <Badge
            variant="secondary"
            className={EVENT_TYPE_COLORS[hook.eventType]}
          >
            {hook.eventType}
          </Badge>

          {/* 安装范围徽章 - 可点击修改 */}
          <ScopeBadge
            scope={currentScope}
            size="sm"
            onClick={onScopeChange ? (e) => {
              e.stopPropagation();
              setScopeDialogOpen(true);
            } : undefined}
          />

          {/* 优先级 */}
          <span className="text-xs text-muted-foreground">
            #{hook.priority}
          </span>

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
            title={t("hooks.openInEditor")}
          >
            <FileEdit size={14} />
          </Button>
        </div>

        {hook.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {hook.description}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
          <span>{sourceLabel}</span>
          {rulesSummary && (
            <>
              <span>·</span>
              <span className="font-mono">{rulesSummary}</span>
            </>
          )}
        </div>
      </div>

      {/* 中间：应用开关 */}
      <div
        className="flex flex-col gap-2 flex-shrink-0 min-w-[120px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${hook.id}-claude`}
            className={`text-sm cursor-pointer ${
              appSupport.claude && hook.enabled
                ? "text-foreground/80"
                : "text-muted-foreground"
            }`}
          >
            {t("hooks.apps.claude")}
          </label>
          <Switch
            id={`${hook.id}-claude`}
            checked={hook.apps.claude}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(hook.id, "claude", checked)
            }
            disabled={!appSupport.claude || !hook.enabled}
            title={
              !appSupport.claude
                ? t("hooks.appUnsupported")
                : !hook.enabled
                  ? t("hooks.enableFirst")
                  : undefined
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${hook.id}-codex`}
            className={`text-sm cursor-pointer ${
              appSupport.codex && hook.enabled
                ? "text-foreground/80"
                : "text-muted-foreground"
            }`}
          >
            {t("hooks.apps.codex")}
          </label>
          <Switch
            id={`${hook.id}-codex`}
            checked={hook.apps.codex}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(hook.id, "codex", checked)
            }
            disabled={!appSupport.codex || !hook.enabled}
            title={
              !appSupport.codex
                ? t("hooks.appUnsupported")
                : !hook.enabled
                  ? t("hooks.enableFirst")
                  : undefined
            }
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={`${hook.id}-gemini`}
            className={`text-sm cursor-pointer ${
              appSupport.gemini && hook.enabled
                ? "text-foreground/80"
                : "text-muted-foreground"
            }`}
          >
            {t("hooks.apps.gemini")}
          </label>
          <Switch
            id={`${hook.id}-gemini`}
            checked={hook.apps.gemini}
            onCheckedChange={(checked: boolean) =>
              onToggleApp(hook.id, "gemini", checked)
            }
            disabled={!appSupport.gemini || !hook.enabled}
            title={
              !appSupport.gemini
                ? t("hooks.appUnsupported")
                : !hook.enabled
                  ? t("hooks.enableFirst")
                  : undefined
            }
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
          title={t("hooks.uninstall")}
        >
          <Trash2 size={16} />
        </Button>
      </div>
    </div>

    {/* 范围修改对话框 */}
    {onScopeChange && (
      <ScopeModifyDialog
        open={scopeDialogOpen}
        onOpenChange={setScopeDialogOpen}
        resourceType="hook"
        resourceName={hook.name}
        currentScope={currentScope}
        onScopeChange={handleScopeChange}
        isLoading={isScopeChanging}
      />
    )}
    </>
  );
};

export default HooksList;
