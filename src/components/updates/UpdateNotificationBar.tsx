import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CloudDownload, Loader2, X } from "lucide-react";
import type { BatchCheckResult } from "@/hooks/useResourceUpdates";

interface UpdateNotificationBarProps {
  /** 检查结果 */
  result: BatchCheckResult;
  /** 资源类型显示名称 */
  resourceLabel: string;
  /** 更新全部回调 */
  onUpdateAll?: () => void;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** 是否正在更新 */
  isUpdating?: boolean;
}

/**
 * 更新通知栏组件
 *
 * 显示资源更新通知，支持：
 * - 显示可更新数量
 * - "更新全部"按钮
 * - 关闭按钮
 */
export const UpdateNotificationBar: React.FC<UpdateNotificationBarProps> = ({
  result,
  resourceLabel,
  onUpdateAll,
  onDismiss,
  isUpdating = false,
}) => {
  const { t } = useTranslation();

  const hasUpdates = result.updateCount > 0;
  const hasDeleted = result.deletedCount > 0;

  if (!hasUpdates && !hasDeleted) {
    return null;
  }

  return (
    <Alert className="bg-primary/5 border-primary/20">
      <CloudDownload className="h-4 w-4 text-primary" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          {hasUpdates && (
            <span>
              {t("updates.notification.available", {
                count: result.updateCount,
                resource: resourceLabel,
              })}
            </span>
          )}
          {hasUpdates && hasDeleted && <span className="mx-2">·</span>}
          {hasDeleted && (
            <span className="text-destructive">
              {t("updates.notification.deleted", {
                count: result.deletedCount,
              })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUpdates && onUpdateAll && (
            <Button
              variant="default"
              size="sm"
              onClick={onUpdateAll}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  {t("updates.updating", "Updating...")}
                </>
              ) : (
                t("updates.updateAll", "Update All")
              )}
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDismiss}
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default UpdateNotificationBar;
