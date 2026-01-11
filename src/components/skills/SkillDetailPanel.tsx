import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  ExternalLink,
  Folder,
  Calendar,
  GitBranch,
  HardDrive,
  ChevronDown,
  ChevronRight,
  FileText,
  Code,
  Eye,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { InstalledSkill } from "@/hooks/useSkills";
import { useSkillContent } from "@/hooks/useSkills";
import { settingsApi } from "@/lib/api";
import { formatInstallTime } from "@/lib/utils/date";

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
  const [contentExpanded, setContentExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<"source" | "rendered">("source");

  const isLocal = !skill.repoOwner;
  const SourceIcon = isLocal ? HardDrive : GitBranch;

  // 只在展开时加载内容
  const { data: content, isLoading: contentLoading } = useSkillContent(
    contentExpanded ? skill.id : null
  );

  const handleViewDocs = async () => {
    if (!skill.readmeUrl) return;
    try {
      await settingsApi.openExternal(skill.readmeUrl);
    } catch {
      // ignore
    }
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
            <span className="text-sm">
              {formatInstallTime(skill.installedAt)}
            </span>
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

        <Separator />

        {/* Content Preview */}
        <div>
          <button
            className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-1 -ml-1 transition-colors"
            onClick={() => setContentExpanded(!contentExpanded)}
          >
            {contentExpanded ? (
              <ChevronDown size={16} className="text-muted-foreground" />
            ) : (
              <ChevronRight size={16} className="text-muted-foreground" />
            )}
            <FileText size={16} className="text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {t("skills.contentPreview", "Content Preview")}
            </span>
          </button>

          {contentExpanded && (
            <div className="mt-2 space-y-2">
              {/* View Mode Toggle */}
              <div className="flex gap-1">
                <Button
                  variant={viewMode === "source" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewMode("source")}
                >
                  <Code size={14} className="mr-1" />
                  {t("skills.sourceView", "Source")}
                </Button>
                <Button
                  variant={viewMode === "rendered" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setViewMode("rendered")}
                >
                  <Eye size={14} className="mr-1" />
                  {t("skills.renderedView", "Preview")}
                </Button>
              </div>

              {/* Content Display */}
              <div className="border rounded-md bg-muted/30 overflow-hidden">
                {contentLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : content ? (
                  viewMode === "source" ? (
                    <pre className="p-3 text-xs overflow-x-auto max-h-[300px] overflow-y-auto font-mono whitespace-pre-wrap break-words">
                      {content}
                    </pre>
                  ) : (
                    <div className="p-3 prose prose-sm dark:prose-invert max-h-[300px] overflow-y-auto">
                      {/* 简单渲染：将 markdown 转为基本 HTML */}
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: content
                            .replace(/^### (.+)$/gm, "<h3>$1</h3>")
                            .replace(/^## (.+)$/gm, "<h2>$1</h2>")
                            .replace(/^# (.+)$/gm, "<h1>$1</h1>")
                            .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                            .replace(/\*(.+?)\*/g, "<em>$1</em>")
                            .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded'>$1</code>")
                            .replace(/^- (.+)$/gm, "<li>$1</li>")
                            .replace(/\n/g, "<br/>"),
                        }}
                      />
                    </div>
                  )
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t("skills.noContent", "No content available")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border space-y-2">
        {skill.readmeUrl && (
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={handleViewDocs}
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
