import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, ExternalLink, GitBranch, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { settingsApi } from "@/lib/api";
import type { InstalledSkill, AppType } from "@/hooks/useSkills";
import { UpdateBadge } from "@/components/updates/UpdateBadge";
import type { UpdateCheckResult } from "@/hooks/useResourceUpdates";
import {
  ScopeBadge,
  createScopeFromDb,
  type InstallScope,
} from "@/components/common/ScopeBadge";
import { ScopeModifyDialog } from "@/components/common/ScopeModifyDialog";

interface SkillListItemProps {
  skill: InstalledSkill;
  isSelected: boolean;
  onSelect: () => void;
  onToggleApp: (app: AppType, enabled: boolean) => void;
  onUninstall: () => void;
  /** 范围变更回调 */
  onScopeChange?: (newScope: InstallScope) => Promise<void>;
  /** 更新状态 */
  updateStatus?: UpdateCheckResult;
}

/**
 * Skill 列表项组件
 */
export const SkillListItem: React.FC<SkillListItemProps> = ({
  skill,
  isSelected,
  onSelect,
  onToggleApp,
  onUninstall,
  onScopeChange,
  updateStatus,
}) => {
  const { t } = useTranslation();
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [isScopeChanging, setIsScopeChanging] = useState(false);

  const isLocal = !skill.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;
  const sourceName = isLocal
    ? t("skills.local", "Local")
    : `${skill.repoOwner}/${skill.repoName}`;

  const currentScope = createScopeFromDb(skill.scope, skill.projectPath);

  const handleScopeChange = async (newScope: InstallScope) => {
    if (!onScopeChange) return;
    setIsScopeChanging(true);
    try {
      await onScopeChange(newScope);
    } finally {
      setIsScopeChanging(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
          isSelected
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/50",
        )}
        onClick={onSelect}
      >
        {/* 左侧：名称、描述和操作按钮 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：名称 + 范围 + 更新徽章 + Badge + 操作按钮 */}
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm truncate">{skill.name}</h4>
            {/* 安装范围徽章 - 可点击修改 */}
            <ScopeBadge
              scope={currentScope}
              size="sm"
              onClick={
                onScopeChange
                  ? (e) => {
                      e.stopPropagation();
                      setScopeDialogOpen(true);
                    }
                  : undefined
              }
            />
            {/* 更新徽章 */}
            <UpdateBadge status={updateStatus} size="sm" />
            <Badge
              variant="outline"
              className="text-xs flex items-center gap-1 flex-shrink-0"
            >
              <SourceIcon size={10} />
              <span className="truncate max-w-[100px]">{sourceName}</span>
            </Badge>
            {/* 操作按钮 */}
            <div className="flex items-center gap-0.5 ml-auto mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
              {skill.readmeUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (skill.readmeUrl) {
                          settingsApi
                            .openExternal(skill.readmeUrl)
                            .catch(() => {});
                        }
                      }}
                    >
                      <ExternalLink size={12} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("skills.viewReadme", "View README")}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUninstall();
                    }}
                  >
                    <Trash2 size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("skills.uninstall", "Uninstall")}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          {/* 第二行：描述 */}
          {skill.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
              {skill.description}
            </p>
          )}
        </div>

        {/* 右侧：三应用开关 - 垂直排列 */}
        <div
          className="flex flex-col gap-1.5 flex-shrink-0 min-w-[100px] mr-1"
          onClick={(e) => e.stopPropagation()}
        >
          <AppSwitch
            app="claude"
            skillId={skill.id}
            enabled={skill.apps.claude}
            onToggle={(enabled) => onToggleApp("claude", enabled)}
            label={t("skills.apps.claude")}
          />
          <AppSwitch
            app="codex"
            skillId={skill.id}
            enabled={skill.apps.codex}
            onToggle={(enabled) => onToggleApp("codex", enabled)}
            label={t("skills.apps.codex")}
          />
          <AppSwitch
            app="gemini"
            skillId={skill.id}
            enabled={skill.apps.gemini}
            onToggle={(enabled) => onToggleApp("gemini", enabled)}
            label={t("skills.apps.gemini")}
          />
        </div>
      </div>

      {/* 范围修改对话框 */}
      {onScopeChange && (
        <ScopeModifyDialog
          open={scopeDialogOpen}
          onOpenChange={setScopeDialogOpen}
          resourceType="skill"
          resourceName={skill.name}
          currentScope={currentScope}
          onScopeChange={handleScopeChange}
          isLoading={isScopeChanging}
        />
      )}
    </>
  );
};

/**
 * 应用开关组件 - 带 label 的水平布局
 */
interface AppSwitchProps {
  app: AppType;
  skillId: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
}

const AppSwitch: React.FC<AppSwitchProps> = ({
  app,
  skillId,
  enabled,
  onToggle,
  label,
}) => {
  const colorClass = {
    claude: "data-[state=checked]:bg-orange-500",
    codex: "data-[state=checked]:bg-green-500",
    gemini: "data-[state=checked]:bg-blue-500",
  }[app];

  const switchId = `${skillId}-${app}`;

  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={switchId}
        className="text-xs cursor-pointer text-foreground/80"
      >
        {label}
      </label>
      <Switch
        id={switchId}
        checked={enabled}
        onCheckedChange={onToggle}
        className={cn("h-4 w-7", colorClass)}
      />
    </div>
  );
};

export default SkillListItem;
