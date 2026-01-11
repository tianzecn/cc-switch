import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ListItemSkeletonProps {
  /** 是否显示右侧开关区域 */
  showSwitches?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 列表项骨架屏组件
 * 用于 Skills/Commands/Agents/Hooks 列表加载时显示
 */
export const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({
  showSwitches = true,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border border-border",
        className,
      )}
    >
      {/* 左侧：名称、描述 */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* 第一行：名称 + Badge */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        {/* 第二行：描述 */}
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* 右侧：开关区域 */}
      {showSwitches && (
        <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[100px]">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-7 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-7 rounded-full" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-7 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

interface ListSkeletonProps {
  /** 显示的骨架屏数量 */
  count?: number;
  /** 是否显示右侧开关区域 */
  showSwitches?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * 列表骨架屏组合组件
 * 用于显示多个列表项骨架屏
 */
export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  count = 5,
  showSwitches = true,
  className,
}) => {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} showSwitches={showSwitches} />
      ))}
    </div>
  );
};

export default ListItemSkeleton;
