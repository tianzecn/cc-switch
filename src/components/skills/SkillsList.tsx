import React from "react";
import { useTranslation } from "react-i18next";
import { PackageOpen } from "lucide-react";
import { SkillListItem } from "./SkillListItem";
import type { InstalledSkill, AppType } from "@/hooks/useSkills";
import { Skeleton } from "@/components/ui/skeleton";

interface SkillsListProps {
  skills: InstalledSkill[];
  selectedSkillId: string | null;
  onSelectSkill: (skill: InstalledSkill | null) => void;
  onToggleApp: (skillId: string, app: AppType, enabled: boolean) => void;
  onUninstall: (skillId: string) => void;
  isLoading?: boolean;
}

/**
 * Skills 列表组件
 */
export const SkillsList: React.FC<SkillsListProps> = ({
  skills,
  selectedSkillId,
  onSelectSkill,
  onToggleApp,
  onUninstall,
  isLoading = false,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <PackageOpen size={48} className="text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">
          {t("skills.noSkillsInstalled", "No skills installed")}
        </h3>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {t(
            "skills.noSkillsDescription",
            "Use the Discover button to find and install skills",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {skills.map((skill) => (
        <SkillListItem
          key={skill.id}
          skill={skill}
          isSelected={selectedSkillId === skill.id}
          onSelect={() =>
            onSelectSkill(selectedSkillId === skill.id ? null : skill)
          }
          onToggleApp={(app, enabled) => onToggleApp(skill.id, app, enabled)}
          onUninstall={() => onUninstall(skill.id)}
        />
      ))}
    </div>
  );
};

export default SkillsList;
