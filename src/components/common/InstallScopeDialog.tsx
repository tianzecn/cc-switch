import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Globe, FolderOpen, Download, Check } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import type { InstallScope } from "./ScopeBadge";
export type { InstallScope };
import { cn } from "@/lib/utils";

/**
 * 资源类型
 */
export type ResourceType = "skill" | "command" | "hook" | "agent";

interface InstallScopeDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 资源类型 */
  resourceType: ResourceType;
  /** 资源名称（用于显示） */
  resourceName: string;
  /** 安装确认回调 */
  onInstall: (scope: InstallScope) => Promise<void>;
  /** 是否正在处理 */
  isLoading?: boolean;
}

/**
 * 安装范围选择对话框组件
 *
 * 用于在安装资源时选择安装范围（全局或项目）
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 *
 * <InstallScopeDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   resourceType="skill"
 *   resourceName="commit"
 *   onInstall={async (scope) => {
 *     await api.installSkill(skill, scope);
 *   }}
 * />
 * ```
 */
export function InstallScopeDialog({
  open,
  onOpenChange,
  resourceType,
  resourceName,
  onInstall,
  isLoading = false,
}: InstallScopeDialogProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<"global" | "project">(
    "global"
  );
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  // 获取资源类型的显示名称
  const resourceTypeLabel = t(`resourceType.${resourceType}`, resourceType);

  // 处理全局安装
  const handleGlobalInstall = async () => {
    const scope: InstallScope = { type: "global" };
    setIsInstalling(true);
    try {
      await onInstall(scope);
      onOpenChange(false);
      // 重置状态
      setSelectedType("global");
      setSelectedProjectPath(null);
    } catch (error) {
      console.error("Failed to install:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  // 处理项目安装确认（已选择项目的情况）
  const handleProjectInstall = async () => {
    if (!selectedProjectPath) return;

    setIsInstalling(true);
    try {
      const scope: InstallScope = { type: "project", path: selectedProjectPath };
      await onInstall(scope);
      onOpenChange(false);
      // 重置状态
      setSelectedType("global");
      setSelectedProjectPath(null);
    } catch (error) {
      console.error("Failed to install:", error);
    } finally {
      setIsInstalling(false);
    }
  };

  // 处理项目选择确认
  const handleProjectConfirm = (projects: string[]) => {
    if (projects.length === 0) return;
    setSelectedProjectPath(projects[0]);
    setShowProjectSelector(false);
  };

  // 处理安装按钮点击
  const handleInstallClick = () => {
    if (selectedType === "global") {
      handleGlobalInstall();
    } else {
      if (selectedProjectPath) {
        handleProjectInstall();
      } else {
        setShowProjectSelector(true);
      }
    }
  };

  // 重置状态（关闭时）
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedType("global");
      setSelectedProjectPath(null);
    }
    onOpenChange(newOpen);
  };

  // 获取安装按钮文本
  const getInstallButtonText = () => {
    if (selectedType === "global") {
      return t("scope.installGlobal", "全局安装");
    }
    if (selectedProjectPath) {
      return t("scope.installToProject", "安装到项目");
    }
    return t("scope.selectProjectFirst", "选择项目");
  };

  // 合并 loading 状态
  const loading = isLoading || isInstalling;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              {t("scope.installTitle", "安装 {{type}}", {
                type: resourceTypeLabel,
              })}
            </DialogTitle>
            <DialogDescription>
              {t("scope.installDescription", "选择「{{name}}」的安装位置", {
                name: resourceName,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* 全局安装选项 */}
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                selectedType === "global" && "border-primary bg-primary/5"
              )}
              onClick={() => {
                setSelectedType("global");
                setSelectedProjectPath(null);
              }}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  selectedType === "global"
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-muted"
                )}
              >
                <Globe
                  className={cn(
                    "h-5 w-5",
                    selectedType === "global"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {t("scope.globalScope", "全局")}
                  </span>
                  {selectedType === "global" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("scope.globalScopeDesc", "对所有项目可用")}
                </div>
              </div>
            </button>

            {/* 项目安装选项 */}
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent",
                selectedType === "project" && "border-primary bg-primary/5"
              )}
              onClick={() => {
                setSelectedType("project");
                // 如果还没有选择项目，自动打开项目选择器
                if (!selectedProjectPath) {
                  setShowProjectSelector(true);
                }
              }}
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  selectedType === "project"
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-muted"
                )}
              >
                <FolderOpen
                  className={cn(
                    "h-5 w-5",
                    selectedType === "project"
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {t("scope.projectScope", "项目")}
                  </span>
                  {selectedType === "project" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("scope.projectScopeDesc", "仅在指定项目中可用")}
                </div>
              </div>
            </button>

            {/* 已选择的项目显示 */}
            {selectedType === "project" && selectedProjectPath && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-1 text-xs font-medium text-muted-foreground">
                  {t("scope.selectedProject", "已选择项目")}
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-green-500" />
                  <span className="truncate text-sm">{selectedProjectPath}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-xs"
                    onClick={() => setShowProjectSelector(true)}
                  >
                    {t("common.change", "更改")}
                  </Button>
                </div>
              </div>
            )}

            {/* 项目选择提示 */}
            {selectedType === "project" && !selectedProjectPath && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-3">
                <div className="text-center text-sm text-muted-foreground">
                  {t(
                    "scope.clickToSelectProject",
                    "点击下方按钮选择目标项目"
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              {t("common.cancel", "取消")}
            </Button>
            <Button
              onClick={handleInstallClick}
              disabled={loading || (selectedType === "project" && !selectedProjectPath)}
            >
              {loading ? (
                <>{t("common.installing", "安装中...")}</>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {getInstallButtonText()}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目选择器 */}
      <ProjectSelector
        open={showProjectSelector}
        onOpenChange={setShowProjectSelector}
        selectedProjects={selectedProjectPath ? [selectedProjectPath] : []}
        onConfirm={handleProjectConfirm}
        multiSelect={false}
        title={t("scope.selectInstallProject", "选择安装项目")}
        description={t(
          "scope.selectInstallProjectDesc",
          "选择要安装资源的目标项目"
        )}
      />
    </>
  );
}
