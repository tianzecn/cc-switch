/**
 * 应用更新对话框
 *
 * 显示更新信息、下载进度和操作按钮
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Download,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type {
  UpdaterPhase,
  DownloadProgress,
  ExtendedUpdateInfo,
} from "@/hooks/useAppUpdater";

interface UpdateDialogProps {
  isOpen: boolean;
  phase: UpdaterPhase;
  updateInfo: ExtendedUpdateInfo | null;
  progress: DownloadProgress | null;
  error: Error | null;
  currentVersion: string;
  onDownload: () => void;
  onInstall: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onDismiss: () => void;
}

/**
 * 格式化下载速度
 */
function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond} B/s`;
  }
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 解析更新日志为列表项
 */
function parseReleaseNotes(notes?: string): string[] {
  if (!notes) return [];

  // 移除 [MANDATORY] 标记
  const cleanNotes = notes.replace(/\[MANDATORY\]/gi, "").trim();

  // 按行分割并过滤空行
  const lines = cleanNotes.split(/\r?\n/).filter((line) => line.trim());

  // 提取列表项（以 - 或 * 或数字开头的行）
  const listItems: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // 匹配 Markdown 列表项
    const match =
      trimmed.match(/^[-*•]\s+(.+)$/) || trimmed.match(/^\d+\.\s+(.+)$/);
    if (match) {
      listItems.push(match[1]);
    } else if (trimmed && !trimmed.startsWith("#")) {
      // 非标题、非空行也作为内容
      listItems.push(trimmed);
    }
  }

  return listItems;
}

export function UpdateDialog({
  isOpen,
  phase,
  updateInfo,
  progress,
  error,
  currentVersion,
  onDownload,
  onInstall,
  onSkip,
  onRetry,
  onDismiss,
}: UpdateDialogProps) {
  const { t } = useTranslation();

  // 解析更新日志
  const releaseNotes = useMemo(
    () => parseReleaseNotes(updateInfo?.notes),
    [updateInfo?.notes],
  );

  // 是否强制更新
  const isMandatory = updateInfo?.mandatory ?? false;

  // 是否可以关闭对话框
  const canDismiss =
    !isMandatory &&
    phase !== "downloading" &&
    phase !== "installing" &&
    phase !== "restarting";

  // 渲染状态图标
  const renderStatusIcon = () => {
    switch (phase) {
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "available":
        return <Download className="h-5 w-5 text-primary" />;
      case "downloading":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "downloaded":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "installing":
      case "restarting":
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-destructive" />;
      default:
        return <RefreshCw className="h-5 w-5 text-primary" />;
    }
  };

  // 渲染标题
  const renderTitle = () => {
    switch (phase) {
      case "checking":
        return t("updater.checking", { defaultValue: "正在检查更新..." });
      case "available":
        return t("updater.newVersionAvailable", { defaultValue: "发现新版本" });
      case "downloading":
        return t("updater.downloading", { defaultValue: "正在下载更新..." });
      case "downloaded":
        return t("updater.downloadComplete", { defaultValue: "下载完成" });
      case "installing":
        return t("updater.installing", { defaultValue: "正在安装更新..." });
      case "restarting":
        return t("updater.restarting", { defaultValue: "正在重启应用..." });
      case "error":
        return t("updater.error", { defaultValue: "更新失败" });
      default:
        return t("updater.title", { defaultValue: "软件更新" });
    }
  };

  // 渲染描述
  const renderDescription = () => {
    switch (phase) {
      case "checking":
        return t("updater.checkingDesc", {
          defaultValue: "正在连接服务器检查更新...",
        });
      case "available":
        return isMandatory
          ? t("updater.mandatoryUpdateDesc", {
              defaultValue: "此更新为强制更新，必须安装后才能继续使用",
            })
          : t("updater.availableDesc", {
              defaultValue: "发现新版本可用，建议立即更新以获得最佳体验",
            });
      case "downloading":
        return progress
          ? `${formatSize(progress.downloaded)} / ${formatSize(progress.total)} (${formatSpeed(progress.speed)})`
          : t("updater.preparingDownload", { defaultValue: "准备下载..." });
      case "downloaded":
        return t("updater.downloadedDesc", {
          defaultValue: "下载完成！点击「立即重启」以完成安装。",
        });
      case "installing":
        return t("updater.installingDesc", {
          defaultValue: "正在安装更新，请稍候...",
        });
      case "restarting":
        return t("updater.restartingDesc", { defaultValue: "应用即将重启..." });
      case "error":
        return (
          error?.message ||
          t("updater.unknownError", { defaultValue: "发生未知错误" })
        );
      default:
        return "";
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && canDismiss) {
          onDismiss();
        }
      }}
    >
      <DialogContent className="max-w-md" zIndex="alert">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            {renderStatusIcon()}
            {renderTitle()}
            {isMandatory && (
              <Badge variant="destructive" className="ml-2">
                {t("updater.mandatory", { defaultValue: "强制" })}
              </Badge>
            )}
          </DialogTitle>

          {/* 版本对比 */}
          {updateInfo &&
            (phase === "available" ||
              phase === "downloading" ||
              phase === "downloaded") && (
              <div className="flex items-center justify-center gap-3 rounded-lg bg-muted/50 px-4 py-3">
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">
                    {t("updater.currentVersion", { defaultValue: "当前版本" })}
                  </div>
                  <div className="font-mono text-sm font-medium">
                    {currentVersion}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="text-center">
                  <div className="text-xs text-muted-foreground">
                    {t("updater.newVersion", { defaultValue: "新版本" })}
                  </div>
                  <div className="font-mono text-sm font-medium text-primary">
                    {updateInfo.availableVersion}
                  </div>
                </div>
              </div>
            )}

          <DialogDescription className="text-sm leading-relaxed">
            {renderDescription()}
          </DialogDescription>

          {/* 下载进度条 */}
          {phase === "downloading" && progress && (
            <div className="space-y-2">
              <Progress value={progress.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.percentage}%</span>
                <span>{formatSpeed(progress.speed)}</span>
              </div>
            </div>
          )}

          {/* 更新日志 */}
          {releaseNotes.length > 0 &&
            (phase === "available" ||
              phase === "downloading" ||
              phase === "downloaded") && (
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  {t("updater.releaseNotes", { defaultValue: "更新内容" })}
                </div>
                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-muted/30 p-3">
                  {releaseNotes.map((note, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-primary" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </DialogHeader>

        <DialogFooter className="flex gap-2 pt-2 sm:justify-end">
          {/* 错误状态 */}
          {phase === "error" && (
            <>
              <Button variant="outline" onClick={onDismiss}>
                {t("common.cancel", { defaultValue: "取消" })}
              </Button>
              <Button onClick={onRetry}>
                <RotateCcw className="mr-2 h-4 w-4" />
                {t("updater.retry", { defaultValue: "重试" })}
              </Button>
            </>
          )}

          {/* 可用更新 */}
          {phase === "available" && (
            <>
              {!isMandatory && (
                <>
                  <Button variant="ghost" size="sm" onClick={onSkip}>
                    {t("updater.skipVersion", { defaultValue: "跳过此版本" })}
                  </Button>
                  <Button variant="outline" onClick={onDismiss}>
                    {t("updater.later", { defaultValue: "稍后" })}
                  </Button>
                </>
              )}
              <Button onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                {t("updater.downloadNow", { defaultValue: "立即下载" })}
              </Button>
            </>
          )}

          {/* 下载中 */}
          {phase === "downloading" && (
            <Button variant="outline" disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("updater.downloading", { defaultValue: "正在下载..." })}
            </Button>
          )}

          {/* 下载完成 */}
          {phase === "downloaded" && (
            <>
              {!isMandatory && (
                <Button variant="outline" onClick={onDismiss}>
                  {t("updater.later", { defaultValue: "稍后" })}
                </Button>
              )}
              <Button onClick={onInstall}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("updater.restartNow", { defaultValue: "立即重启" })}
              </Button>
            </>
          )}

          {/* 安装中 / 重启中 */}
          {(phase === "installing" || phase === "restarting") && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {phase === "installing"
                ? t("updater.installing", { defaultValue: "安装中..." })
                : t("updater.restarting", { defaultValue: "重启中..." })}
            </Button>
          )}

          {/* 检查中 */}
          {phase === "checking" && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("updater.checking", { defaultValue: "检查中..." })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
