import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import { useValidProjects } from "@/hooks/useProjects";
import { FolderOpen, Search, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectInfo } from "@/lib/api";

interface ProjectSelectorProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 已选择的项目路径 */
  selectedProjects: string[];
  /** 确认选择回调 */
  onConfirm: (projects: string[]) => void;
  /** 是否允许多选 */
  multiSelect?: boolean;
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(
  dateStr: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: (key: string, options?: any) => string
): string {
  if (!dateStr) return t("project.unknownTime");

  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return t("project.justNow");
  if (diffMins < 60) return t("project.minutesAgo", { count: diffMins });
  if (diffHours < 24) return t("project.hoursAgo", { count: diffHours });
  if (diffDays < 7) return t("project.daysAgo", { count: diffDays });
  return date.toLocaleDateString();
}

/**
 * 项目选择器组件
 *
 * 用于选择安装目标项目的多选弹窗
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const [selected, setSelected] = useState<string[]>([]);
 *
 * <ProjectSelector
 *   open={open}
 *   onOpenChange={setOpen}
 *   selectedProjects={selected}
 *   onConfirm={(projects) => {
 *     setSelected(projects);
 *     // 处理安装逻辑...
 *   }}
 * />
 * ```
 */
export function ProjectSelector({
  open,
  onOpenChange,
  selectedProjects,
  onConfirm,
  multiSelect = false,
  title,
  description,
}: ProjectSelectorProps) {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useValidProjects();

  const [searchQuery, setSearchQuery] = useState("");
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    new Set(selectedProjects)
  );

  // 过滤项目列表
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;

    const query = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.path.toLowerCase().includes(query)
    );
  }, [projects, searchQuery]);

  // 当对话框打开时，同步本地选择状态
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setLocalSelection(new Set(selectedProjects));
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  // 切换项目选择
  const toggleProject = (path: string) => {
    const newSelection = new Set(localSelection);

    if (multiSelect) {
      if (newSelection.has(path)) {
        newSelection.delete(path);
      } else {
        newSelection.add(path);
      }
    } else {
      // 单选模式
      newSelection.clear();
      newSelection.add(path);
    }

    setLocalSelection(newSelection);
  };

  // 确认选择
  const handleConfirm = () => {
    onConfirm(Array.from(localSelection));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {title || t("project.selectTitle", "选择项目")}
          </DialogTitle>
          <DialogDescription>
            {description ||
              t(
                "project.selectDescription",
                "选择要安装资源的目标项目"
              )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("project.searchPlaceholder", "搜索项目...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 项目列表 */}
          <div className="max-h-[300px] overflow-y-auto rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                {t("common.loading", "加载中...")}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8" />
                <span>
                  {searchQuery
                    ? t("project.noSearchResults", "没有找到匹配的项目")
                    : t("project.noProjects", "没有可用的项目")}
                </span>
              </div>
            ) : (
              <div className="divide-y">
                {filteredProjects.map((project) => (
                  <ProjectItem
                    key={project.path}
                    project={project}
                    isSelected={localSelection.has(project.path)}
                    onToggle={() => toggleProject(project.path)}
                    multiSelect={multiSelect}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 选择计数 */}
          {multiSelect && localSelection.size > 0 && (
            <div className="text-sm text-muted-foreground">
              {t("project.selectedCount", "已选择 {{count}} 个项目", {
                count: localSelection.size,
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "取消")}
          </Button>
          <Button onClick={handleConfirm} disabled={localSelection.size === 0}>
            {t("common.confirm", "确认")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 项目列表项组件
 */
function ProjectItem({
  project,
  isSelected,
  onToggle,
  multiSelect,
  t,
}: {
  project: ProjectInfo;
  isSelected: boolean;
  onToggle: () => void;
  multiSelect: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-accent",
        isSelected && "bg-accent/50"
      )}
      onClick={onToggle}
    >
      {multiSelect ? (
        <Checkbox checked={isSelected} />
      ) : (
        <div
          className={cn(
            "h-4 w-4 rounded-full border-2",
            isSelected
              ? "border-primary bg-primary"
              : "border-muted-foreground"
          )}
        >
          {isSelected && (
            <div className="flex h-full items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            </div>
          )}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{project.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{project.path}</span>
        </div>
      </div>

      {project.lastUsed && (
        <div className="flex flex-shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(project.lastUsed, t)}</span>
        </div>
      )}
    </div>
  );
}
