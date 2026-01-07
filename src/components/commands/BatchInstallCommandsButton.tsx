import React from "react";
import { useTranslation } from "react-i18next";
import { Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { BatchInstallCommandsState } from "@/hooks/useBatchInstallCommands";

interface BatchInstallCommandsButtonProps {
  /** 未安装的数量 */
  uninstalledCount: number;
  /** 批量安装状态 */
  state: BatchInstallCommandsState;
  /** 开始安装回调 */
  onStartInstall: () => void;
  /** 取消安装回调 */
  onCancelInstall: () => void;
  /** 是否禁用 */
  disabled?: boolean;
}

/**
 * Commands 批量安装按钮组件
 * 支持三种状态：
 * 1. 未开始：显示"安装全部"按钮
 * 2. 安装中：显示进度条和当前命令名称
 * 3. 已完成：自动隐藏或显示结果
 */
export const BatchInstallCommandsButton: React.FC<BatchInstallCommandsButtonProps> = ({
  uninstalledCount,
  state,
  onStartInstall,
  onCancelInstall,
  disabled = false,
}) => {
  const { t } = useTranslation();

  // 如果没有未安装的命令，不显示
  if (uninstalledCount === 0 && !state.isInstalling) {
    return null;
  }

  // 安装中状态
  if (state.isInstalling) {
    const progress =
      state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
        {/* 进度信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium text-primary">
              {t("commands.batch.installing", "Installing...")}
            </span>
            <span className="text-xs text-muted-foreground">
              {state.current}/{state.total}
            </span>
          </div>

          {/* 进度条 */}
          <Progress value={progress} className="h-1.5" />

          {/* 当前命令名称 */}
          {state.currentName && (
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              {t("commands.batch.currentCommand", "Installing: {{name}}", {
                name: state.currentName,
              })}
            </p>
          )}

          {/* 失败数量提示 */}
          {state.failed > 0 && (
            <p className="text-xs text-destructive mt-1">
              {t("commands.batch.failedCount", "{{count}} failed", {
                count: state.failed,
              })}
            </p>
          )}
        </div>

        {/* 取消按钮 */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancelInstall}
          className="flex-shrink-0"
        >
          <X size={16} className="mr-1" />
          {t("common.cancel", "Cancel")}
        </Button>
      </div>
    );
  }

  // 未开始状态：显示安装按钮
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onStartInstall}
      disabled={disabled || uninstalledCount === 0}
      className="gap-2"
    >
      <Download size={16} />
      {t("commands.batch.installAll", "Install All")}
      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
        {uninstalledCount}
      </span>
    </Button>
  );
};

/**
 * Commands 批量安装进度条组件（内联版本）
 * 用于在列表头部显示安装进度
 */
interface BatchInstallCommandsProgressProps {
  state: BatchInstallCommandsState;
  onCancel: () => void;
}

export const BatchInstallCommandsProgress: React.FC<BatchInstallCommandsProgressProps> = ({
  state,
  onCancel,
}) => {
  const { t } = useTranslation();

  if (!state.isInstalling) {
    return null;
  }

  const progress =
    state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/50 rounded-md">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">
            {t("commands.batch.progress", "Installing {{current}}/{{total}}", {
              current: state.current,
              total: state.total,
            })}
          </span>
          {state.currentName && (
            <span className="text-xs text-muted-foreground truncate">
              {state.currentName}
            </span>
          )}
        </div>
        <Progress value={progress} className="h-1 mt-1" />
      </div>
      <Button variant="ghost" size="icon" onClick={onCancel} className="h-6 w-6">
        <X size={14} />
      </Button>
    </div>
  );
};

export default BatchInstallCommandsButton;
