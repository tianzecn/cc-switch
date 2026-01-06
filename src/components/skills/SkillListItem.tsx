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
        "group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      )}
      onClick={onSelect}
    >
      {/* 左侧：名称和描述 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{skill.name}</h4>
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <SourceIcon size={10} />
            <span className="truncate max-w-[100px]">{sourceName}</span>
          </Badge>
        </div>
        {skill.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {skill.description}
          </p>
        )}
      </div>

      {/* 三应用开关 */}
      <div className="flex items-center gap-2">
        <AppSwitch
          app="claude"
          enabled={skill.apps.claude}
          onToggle={(enabled) => onToggleApp("claude", enabled)}
          label="Claude"
        />
        <AppSwitch
          app="codex"
          enabled={skill.apps.codex}
          onToggle={(enabled) => onToggleApp("codex", enabled)}
          label="Codex"
        />
        <AppSwitch
          app="gemini"
          enabled={skill.apps.gemini}
          onToggle={(enabled) => onToggleApp("gemini", enabled)}
          label="Gemini"
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {skill.readmeUrl && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(skill.readmeUrl, "_blank");
                }}
              >
                <ExternalLink size={14} />
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
              className="h-7 w-7 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onUninstall();
              }}
            >
              <Trash2 size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("skills.uninstall", "Uninstall")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

/**
 * 应用开关组件
 */
interface AppSwitchProps {
  app: AppType;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
}

const AppSwitch: React.FC<AppSwitchProps> = ({
  app,
  enabled,
  onToggle,
  label,
}) => {
  const colorClass = {
    claude: "data-[state=checked]:bg-orange-500",
    codex: "data-[state=checked]:bg-green-500",
    gemini: "data-[state=checked]:bg-blue-500",
  }[app];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            className={cn("h-4 w-7", colorClass)}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export default SkillListItem;
