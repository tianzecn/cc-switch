import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowUp, Trash2 } from "lucide-react";
import type { UpdateCheckResult } from "@/hooks/useResourceUpdates";

interface UpdateBadgeProps {
  /** 更新检查结果 */
  status?: UpdateCheckResult;
  /** 尺寸 */
  size?: "sm" | "default";
}

/**
 * 更新状态徽章组件
 *
 * 根据更新状态显示：
 * - 有更新：蓝色向上箭头
 * - 远程已删除：红色警告
 * - 无更新或未检查：不显示
 */
export const UpdateBadge: React.FC<UpdateBadgeProps> = ({
  status,
  size = "sm",
}) => {
  const { t } = useTranslation();

  if (!status) return null;

  // 远程已删除
  if (status.remoteDeleted) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="h-5 px-1.5 gap-0.5">
            <Trash2 size={size === "sm" ? 12 : 14} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          {t("updates.badge.deleted", "Source has been removed")}
        </TooltipContent>
      </Tooltip>
    );
  }

  // 有更新
  if (status.hasUpdate) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="h-5 px-1.5 gap-0.5 bg-primary/90">
            <ArrowUp size={size === "sm" ? 12 : 14} />
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div>{t("updates.badge.available", "Update available")}</div>
            {status.commitMessage && (
              <div className="text-xs text-muted-foreground max-w-[200px] truncate">
                {status.commitMessage}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return null;
};

export default UpdateBadge;
