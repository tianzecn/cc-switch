import React from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SkillConflict } from "@/hooks/useSkills";

interface SkillConflictPanelProps {
  conflicts: SkillConflict[];
}

/**
 * Skill 冲突面板组件
 * 显示跨仓库同名 Skill 的冲突信息
 */
export const SkillConflictPanel: React.FC<SkillConflictPanelProps> = ({
  conflicts,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = React.useState(true);

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/5">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between px-4 py-3 h-auto hover:bg-yellow-500/10"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-yellow-500" />
              <span className="font-medium text-yellow-700 dark:text-yellow-400">
                {t("skills.conflictsDetected", "Conflicts Detected")}
              </span>
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-500/50"
              >
                {conflicts.length}
              </Badge>
            </div>
            {isOpen ? (
              <ChevronDown size={18} className="text-yellow-500" />
            ) : (
              <ChevronRight size={18} className="text-yellow-500" />
            )}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t(
                "skills.conflictsDescription",
                "The following skills have the same directory name but come from different sources. This may cause unexpected behavior.",
              )}
            </p>

            {conflicts.map((conflict) => (
              <div
                key={conflict.directory}
                className="p-3 rounded-md bg-background border border-border"
              >
                <div className="flex items-center gap-2 mb-2">
                  <code className="text-sm font-mono bg-muted px-1.5 py-0.5 rounded">
                    {conflict.directory}
                  </code>
                  <Badge variant="secondary" className="text-xs">
                    {conflict.conflictingSkills.length}{" "}
                    {t("skills.sources", "sources")}
                  </Badge>
                </div>

                <div className="space-y-1">
                  {conflict.conflictingSkills.map((skill) => (
                    <div
                      key={skill.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        {skill.repoOwner
                          ? `${skill.repoOwner}/${skill.repoName}`
                          : t("skills.local", "Local")}
                      </span>
                      <span className="font-medium">{skill.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              {t(
                "skills.conflictsResolution",
                "Consider uninstalling duplicate skills or renaming the directories to resolve conflicts.",
              )}
            </p>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default SkillConflictPanel;
