import React from "react";
import { useTranslation } from "react-i18next";
import { Trash2, ExternalLink, FileEdit, GitBranch, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { InstalledAgent, AppType } from "@/hooks/useAgents";

interface AgentListItemProps {
  agent: InstalledAgent;
  isSelected: boolean;
  onSelect: () => void;
  onToggleApp: (app: AppType, enabled: boolean) => void;
  onUninstall: () => void;
  onOpenEditor: () => void;
  onOpenDocs?: () => void;
  appSupport?: {
    claude: boolean;
    codex: boolean;
    gemini: boolean;
  };
}

/**
 * Agent 列表项组件
 * 统一风格，类似 SkillListItem
 */
export const AgentListItem: React.FC<AgentListItemProps> = ({
  agent,
  isSelected,
  onSelect,
  onToggleApp,
  onUninstall,
  onOpenEditor,
  onOpenDocs,
  appSupport = { claude: true, codex: false, gemini: false },
}) => {
  const { t } = useTranslation();
  const isLocal = !agent.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;
  const sourceName = isLocal
    ? t("agents.local", "Local")
    : `${agent.repoOwner}/${agent.repoName}`;

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
          <h4 className="font-medium text-sm truncate">{agent.id}</h4>
          <Badge variant="outline" className="text-xs flex items-center gap-1 flex-shrink-0">
            <SourceIcon size={10} />
            <span className="truncate max-w-[100px]">{sourceName}</span>
          </Badge>
          {/* 操作按钮 */}
          <div className="flex items-center gap-0.5 ml-auto mr-4 opacity-0 group-hover:opacity-100 transition-opacity">
            {onOpenDocs && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDocs();
                    }}
                  >
                    <ExternalLink size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t("agents.viewDocs", "View Documentation")}
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenEditor();
                  }}
                >
                  <FileEdit size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("agents.openInEditor", "Open in Editor")}
              </TooltipContent>
            </Tooltip>
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
              <TooltipContent>{t("agents.uninstall", "Uninstall")}</TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* 第二行：描述 */}
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {agent.description}
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
          agentId={agent.id}
          enabled={agent.apps.claude}
          supported={appSupport.claude}
          onToggle={(enabled) => onToggleApp("claude", enabled)}
          label={t("agents.apps.claude")}
        />
        <AppSwitch
          app="codex"
          agentId={agent.id}
          enabled={agent.apps.codex}
          supported={appSupport.codex}
          onToggle={(enabled) => onToggleApp("codex", enabled)}
          label={t("agents.apps.codex")}
        />
        <AppSwitch
          app="gemini"
          agentId={agent.id}
          enabled={agent.apps.gemini}
          supported={appSupport.gemini}
          onToggle={(enabled) => onToggleApp("gemini", enabled)}
          label={t("agents.apps.gemini")}
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
  agentId: string;
  enabled: boolean;
  supported: boolean;
  onToggle: (enabled: boolean) => void;
  label: string;
}

const AppSwitch: React.FC<AppSwitchProps> = ({
  app,
  agentId,
  enabled,
  supported,
  onToggle,
  label,
}) => {
  const { t } = useTranslation();
  const colorClass = {
    claude: "data-[state=checked]:bg-orange-500",
    codex: "data-[state=checked]:bg-green-500",
    gemini: "data-[state=checked]:bg-blue-500",
  }[app];

  const switchId = `${agentId}-${app}`;

  return (
    <div className="flex items-center justify-between gap-3">
      <label
        htmlFor={switchId}
        className={cn(
          "text-xs cursor-pointer",
          supported ? "text-foreground/80" : "text-muted-foreground"
        )}
      >
        {label}
      </label>
      <Switch
        id={switchId}
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={!supported}
        title={!supported ? t("agents.appUnsupported") : undefined}
        className={cn("h-4 w-7", colorClass)}
      />
    </div>
  );
};

export default AgentListItem;
