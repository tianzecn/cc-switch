import React from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ExternalLink,
  Folder,
  Calendar,
  GitBranch,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { InstalledSkill } from "@/hooks/useSkills";

interface SkillDetailPanelProps {
  skill: InstalledSkill;
  onClose: () => void;
  onOpenInEditor?: () => void;
}

/**
 * Skill 详情面板组件
 */
export const SkillDetailPanel: React.FC<SkillDetailPanelProps> = ({
  skill,
  onClose,
  onOpenInEditor,
}) => {
  const { t } = useTranslation();
  const isLocal = !skill.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="flex flex-col h-full border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-lg truncate">{skill.name}</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={18} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        {skill.description && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-1">
              {t("skills.description", "Description")}
            </h4>
            <p className="text-sm">{skill.description}</p>
          </div>
        )}

        <Separator />

        {/* Metadata */}
        <div className="space-y-3">
          {/* Source */}
          <div className="flex items-center gap-2">
            <SourceIcon size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("skills.source", "Source")}:
            </span>
            <Badge variant="outline" className="text-xs">
              {isLocal
                ? t("skills.local", "Local")
                : `${skill.repoOwner}/${skill.repoName}`}
            </Badge>
          </div>

          {/* Namespace */}
          <div className="flex items-center gap-2">
            <Folder size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("skills.namespace", "Namespace")}:
            </span>
            <span className="text-sm">
              {skill.namespace || t("skills.rootNamespace", "Root")}
            </span>
          </div>

          {/* Directory */}
          <div className="flex items-center gap-2">
            <Folder size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("skills.directory", "Directory")}:
            </span>
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {skill.directory}
            </code>
          </div>

          {/* Installed Date */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t("skills.installedAt", "Installed")}:
            </span>
            <span className="text-sm">{formatDate(skill.installedAt)}</span>
          </div>
        </div>

        <Separator />

        {/* App Status */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t("skills.enabledApps", "Enabled Apps")}
          </h4>
          <div className="flex gap-2">
            {skill.apps.claude && (
              <Badge className="bg-orange-500/10 text-orange-600 hover:bg-orange-500/20">
                Claude
              </Badge>
            )}
            {skill.apps.codex && (
              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                Codex
              </Badge>
            )}
            {skill.apps.gemini && (
              <Badge className="bg-blue-500/10 text-blue-600 hover:bg-blue-500/20">
                Gemini
              </Badge>
            )}
            {!skill.apps.claude && !skill.apps.codex && !skill.apps.gemini && (
              <span className="text-sm text-muted-foreground">
                {t("skills.noAppsEnabled", "No apps enabled")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        {skill.readmeUrl && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => window.open(skill.readmeUrl, "_blank")}
          >
            <ExternalLink size={16} className="mr-2" />
            {t("skills.viewReadme", "View README")}
          </Button>
        )}

        {onOpenInEditor && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={onOpenInEditor}
          >
            <Folder size={16} className="mr-2" />
            {t("skills.openInEditor", "Open in Editor")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default SkillDetailPanel;
