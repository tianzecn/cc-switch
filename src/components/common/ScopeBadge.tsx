import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Globe, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * 安装范围类型
 */
export interface InstallScope {
  /** 范围类型 */
  type: "global" | "project";
  /** 项目路径（当 type="project" 时有效） */
  path?: string;
}

interface ScopeBadgeProps {
  /** 安装范围 */
  scope: InstallScope;
  /** 项目路径列表（用于多项目展示） */
  projectPaths?: string[];
  /** 点击回调 */
  onClick?: (e: React.MouseEvent) => void;
  /** 额外的 CSS 类名 */
  className?: string;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 尺寸 */
  size?: "sm" | "default";
}

/**
 * 从项目路径提取项目名称
 */
function getProjectName(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

/**
 * 范围标签组件
 *
 * 显示资源的安装范围（全局或项目）
 *
 * @example
 * ```tsx
 * // 全局安装
 * <ScopeBadge scope={{ type: "global" }} />
 *
 * // 项目安装
 * <ScopeBadge scope={{ type: "project", path: "/path/to/project" }} />
 *
 * // 可点击的标签
 * <ScopeBadge
 *   scope={{ type: "project", path: "/path/to/project" }}
 *   onClick={() => setDialogOpen(true)}
 * />
 * ```
 */
export function ScopeBadge({
  scope,
  projectPaths,
  onClick,
  className,
  showIcon = true,
  size = "default",
}: ScopeBadgeProps) {
  const { t } = useTranslation();

  const isGlobal = scope.type === "global";
  const isClickable = !!onClick;

  // 计算显示内容
  let displayText: string;
  let tooltipContent: string | null = null;

  if (isGlobal) {
    displayText = t("scope.global", "全局");
  } else if (projectPaths && projectPaths.length > 1) {
    // 多项目情况
    const firstName = getProjectName(projectPaths[0]);
    const extraCount = projectPaths.length - 1;
    displayText = `${firstName} +${extraCount}`;
    tooltipContent = projectPaths.map(getProjectName).join("\n");
  } else if (scope.path) {
    displayText = getProjectName(scope.path);
    tooltipContent = scope.path;
  } else {
    displayText = t("scope.project", "项目");
  }

  const sizeClasses = {
    sm: "px-1.5 py-0 text-[10px]",
    default: "px-2 py-0.5 text-xs",
  };

  const badge = (
    <Badge
      variant={isGlobal ? "secondary" : "outline"}
      className={cn(
        "gap-1 font-normal",
        sizeClasses[size],
        isClickable && "cursor-pointer hover:bg-accent",
        isGlobal
          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
          : "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
        className
      )}
      onClick={onClick}
    >
      {showIcon &&
        (isGlobal ? (
          <Globe className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />
        ) : (
          <FolderOpen
            className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")}
          />
        ))}
      {displayText}
    </Badge>
  );

  // 如果有 tooltip 内容，包装在 Tooltip 中
  if (tooltipContent) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs whitespace-pre-line">
            {tooltipContent}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/**
 * 从数据库字段创建 InstallScope
 */
export function createScopeFromDb(
  scope: string,
  projectPath?: string | null
): InstallScope {
  if (scope === "project" && projectPath) {
    return { type: "project", path: projectPath };
  }
  return { type: "global" };
}
