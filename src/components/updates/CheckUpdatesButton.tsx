import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CloudDownload, Loader2, RefreshCcw } from "lucide-react";
import type { BatchCheckResult } from "@/hooks/useResourceUpdates";

interface CheckUpdatesButtonProps {
  /** 是否正在检查 */
  isChecking: boolean;
  /** 检查更新回调 */
  onCheck: () => void;
  /** 检查结果（用于显示更新数量） */
  result?: BatchCheckResult;
  /** 是否禁用 */
  disabled?: boolean;
  /** 按钮大小 */
  size?: "sm" | "default" | "lg";
}

/**
 * 检查更新按钮组件
 *
 * 显示检查更新按钮，支持：
 * - 检查中的 Loading 状态
 * - 有更新时显示数量 Badge
 */
export const CheckUpdatesButton: React.FC<CheckUpdatesButtonProps> = ({
  isChecking,
  onCheck,
  result,
  disabled = false,
  size = "sm",
}) => {
  const { t } = useTranslation();

  const hasUpdates = (result?.updateCount ?? 0) > 0;
  const updateCount = result?.updateCount ?? 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={hasUpdates ? "default" : "outline"}
          size={size}
          onClick={onCheck}
          disabled={disabled || isChecking}
          className="relative"
        >
          {isChecking ? (
            <Loader2 size={16} className="animate-spin" />
          ) : hasUpdates ? (
            <CloudDownload size={16} />
          ) : (
            <RefreshCcw size={16} />
          )}
          {hasUpdates && (
            <span className="ml-1.5 text-xs font-medium">
              {updateCount}
            </span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isChecking
          ? t("updates.checking", "Checking for updates...")
          : hasUpdates
            ? t("updates.available", "{{count}} updates available", {
                count: updateCount,
              })
            : t("updates.check", "Check for updates")}
      </TooltipContent>
    </Tooltip>
  );
};

export default CheckUpdatesButton;
