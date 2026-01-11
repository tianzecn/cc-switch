import React, { useRef, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { ListSkeleton } from "./ListItemSkeleton";

interface VirtualListProps<T> {
  /** 列表数据 */
  items: T[];
  /** 渲染列表项 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 获取项目的唯一 key */
  getItemKey: (item: T, index: number) => string | number;
  /** 预估的项目高度（用于虚拟滚动计算） */
  estimatedItemHeight?: number;
  /** 过度扫描数量（提前渲染的项目数） */
  overscan?: number;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 加载时显示的骨架屏数量 */
  skeletonCount?: number;
  /** 空状态渲染 */
  emptyState?: React.ReactNode;
  /** 容器类名 */
  className?: string;
  /** 是否显示骨架屏的开关区域 */
  showSkeletonSwitches?: boolean;
  /** 每批加载数量（用于无限滚动） */
  batchSize?: number;
  /** 是否还有更多数据 */
  hasMore?: boolean;
  /** 加载更多回调 */
  onLoadMore?: () => void;
}

/**
 * 通用虚拟列表组件
 * 支持虚拟滚动、骨架屏加载状态和无限滚动
 */
export function VirtualList<T>({
  items,
  renderItem,
  getItemKey,
  estimatedItemHeight = 80,
  overscan = 5,
  isLoading = false,
  skeletonCount = 5,
  emptyState,
  className,
  showSkeletonSwitches = true,
  batchSize: _batchSize = 50,
  hasMore = false,
  onLoadMore,
}: VirtualListProps<T>): React.ReactElement {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
    getItemKey: (index) => getItemKey(items[index], index),
  });

  const virtualItems = virtualizer.getVirtualItems();

  // 检测滚动到底部
  const handleScroll = useCallback(() => {
    if (!parentRef.current || !hasMore || !onLoadMore) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    // 当滚动到距底部 200px 时触发加载
    if (scrollHeight - scrollTop - clientHeight < 200) {
      onLoadMore();
    }
  }, [hasMore, onLoadMore]);

  // 加载中状态
  if (isLoading && items.length === 0) {
    return (
      <div className={cn("overflow-y-auto", className)}>
        <ListSkeleton
          count={skeletonCount}
          showSwitches={showSkeletonSwitches}
        />
      </div>
    );
  }

  // 空状态
  if (items.length === 0 && emptyState) {
    return <div className={className}>{emptyState}</div>;
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-y-auto", className)}
      onScroll={handleScroll}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>

      {/* 加载更多指示器 */}
      {hasMore && isLoading && (
        <div className="py-4">
          <ListSkeleton count={2} showSwitches={showSkeletonSwitches} />
        </div>
      )}
    </div>
  );
}

export default VirtualList;
