import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/hooks/useLayoutMode";

interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "standard" | "wide";
}

export function ContentContainer({
  children,
  className,
  variant = "standard",
}: ContentContainerProps) {
  const { mode } = useLayoutMode();

  const widthClasses =
    mode === "adaptive"
      ? "w-[95%] max-w-[1920px]"
      : variant === "wide"
        ? "max-w-[72rem]"
        : "max-w-[56rem]";

  return (
    <div
      className={cn(
        "mx-auto",
        widthClasses,
        // 响应式内边距
        "px-4 sm:px-6 lg:px-8",
        // 过渡动画
        "transition-[width,max-width,padding] duration-150 ease-out",
        className,
      )}
    >
      {children}
    </div>
  );
}
