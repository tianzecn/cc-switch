import React from "react";
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
import type { InstalledSkill, AppType } from "@/hooks/useSkills";

interface SkillListItemProps {
  skill: InstalledSkill;
  isSelected: boolean;
  onSelect: () => void;
  onToggleApp: (app: AppType, enabled: boolean) => void;
  onUninstall: () => void;
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
}) => {
  const { t } = useTranslation();
  const isLocal = !skill.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;
  const sourceName = isLocal
    ? t("skills.local", "Local")
    : `${skill.repoOwner}/${skill.repoName}`;

  return (
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
        {/* 第一行：名称 + Badge + 操作按钮 */}
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{skill.name}</h4>
          <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
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
                      window.open(skill.readmeUrl, "_blank");
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
              <TooltipContent>{t("skills.uninstall", "Uninstall")}</TooltipContent>
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
