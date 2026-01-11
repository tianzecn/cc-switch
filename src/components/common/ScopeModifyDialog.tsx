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
import { Globe, FolderOpen, ArrowRight, AlertTriangle } from "lucide-react";
import { ProjectSelector } from "./ProjectSelector";
import { ScopeBadge, type InstallScope } from "./ScopeBadge";

/**
 * 资源类型
 */
export type ResourceType = "skill" | "command" | "hook" | "agent";

interface ScopeModifyDialogProps {
  /** 是否打开 */
  open: boolean;
  /** 打开状态变化回调 */
  onOpenChange: (open: boolean) => void;
  /** 资源类型 */
  resourceType: ResourceType;
  /** 资源名称（用于显示） */
  resourceName: string;
  /** 当前安装范围 */
  currentScope: InstallScope;
  /** 范围变更回调 */
  onScopeChange: (newScope: InstallScope) => Promise<void>;
  /** 是否正在处理 */
  isLoading?: boolean;
}

/**
 * 范围修改对话框组件
 *
 * 用于修改资源的安装范围（全局 ↔ 项目）
 *
 * @example
 * ```tsx
 * const [open, setOpen] = useState(false);
 * const skillId = "anthropic/claude-code-base-skills:commit";
 *
 * <ScopeModifyDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   resourceType="skill"
 *   resourceName="commit"
 *   currentScope={{ type: "global" }}
 *   onScopeChange={async (newScope) => {
 *     await api.changeScopeSkill(skillId, newScope);
 *   }}
 * />
 * ```
 */
export function ScopeModifyDialog({
  open,
  onOpenChange,
  resourceType: _resourceType,
  resourceName,
  currentScope,
  onScopeChange,
  isLoading = false,
}: ScopeModifyDialogProps) {
  const { t } = useTranslation();
  const [showProjectSelector, setShowProjectSelector] = useState(false);

  const isGlobal = currentScope.type === "global";

  // 资源类型保留用于未来扩展（如显示类型特定的警告信息）
  void _resourceType;

  // 处理升级到全局
  const handleUpgradeToGlobal = async () => {
    const newScope: InstallScope = { type: "global" };
    try {
      await onScopeChange(newScope);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to change scope:", error);
    }
  };

  // 处理降级到项目
  const handleDowngradeToProject = () => {
    setShowProjectSelector(true);
  };

  // 处理项目选择确认
  const handleProjectConfirm = async (projects: string[]) => {
    if (projects.length === 0) return;

    const newScope: InstallScope = { type: "project", path: projects[0] };
    setShowProjectSelector(false);

    try {
      await onScopeChange(newScope);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to change scope:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isGlobal ? (
                <Globe className="h-5 w-5 text-blue-500" />
              ) : (
                <FolderOpen className="h-5 w-5 text-green-500" />
              )}
              {t("scope.modifyTitle", "修改安装范围")}
            </DialogTitle>
            <DialogDescription>
              {t("scope.modifyDescription", "更改「{{name}}」的安装位置", {
                name: resourceName,
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 当前状态 */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {t("scope.currentScope", "当前范围")}
              </div>
              <div className="flex items-center gap-2">
                <ScopeBadge scope={currentScope} />
                {currentScope.type === "project" && currentScope.path && (
                  <span className="text-sm text-muted-foreground">
                    {currentScope.path}
                  </span>
                )}
              </div>
            </div>

            {/* 操作选项 */}
            <div className="space-y-2">
              {isGlobal ? (
                // 全局 → 项目
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 p-3"
                  onClick={handleDowngradeToProject}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    <ArrowRight className="h-3 w-3" />
                    <FolderOpen className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {t("scope.moveToProject", "移动到项目")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t("scope.moveToProjectDesc", "从全局移动到指定项目目录")}
                    </span>
                  </div>
                </Button>
              ) : (
                // 项目 → 全局
                <Button
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 p-3"
                  onClick={handleUpgradeToGlobal}
                  disabled={isLoading}
                >
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-green-500" />
                    <ArrowRight className="h-3 w-3" />
                    <Globe className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">
                      {t("scope.upgradeToGlobal", "升级到全局")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(
                        "scope.upgradeToGlobalDesc",
                        "从项目移动到全局目录，对所有项目可用",
                      )}
                    </span>
                  </div>
                </Button>
              )}
            </div>

            {/* 警告提示 */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
              <div className="text-amber-700 dark:text-amber-300">
                {isGlobal
                  ? t(
                      "scope.warningGlobalToProject",
                      "移动后，该资源将仅在选择的项目中可用",
                    )
                  : t(
                      "scope.warningProjectToGlobal",
                      "升级后，该资源将从原项目目录移除，并在全局可用",
                    )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {t("common.cancel", "取消")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 项目选择器 */}
      <ProjectSelector
        open={showProjectSelector}
        onOpenChange={setShowProjectSelector}
        selectedProjects={[]}
        onConfirm={handleProjectConfirm}
        multiSelect={false}
        title={t("scope.selectTargetProject", "选择目标项目")}
        description={t(
          "scope.selectTargetProjectDesc",
          "选择要将资源移动到的项目",
        )}
      />
    </>
  );
}
