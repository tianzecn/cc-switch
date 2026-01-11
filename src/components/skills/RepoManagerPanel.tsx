import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink, Plus, RotateCcw } from "lucide-react";
import { settingsApi } from "@/lib/api";
import { FullScreenPanel } from "@/components/common/FullScreenPanel";
import type { DiscoverableSkill, SkillRepo } from "@/lib/api/skills";

interface RepoManagerPanelProps {
  repos: SkillRepo[];
  skills: DiscoverableSkill[];
  onAdd: (repo: SkillRepo) => Promise<void>;
  onRemove: (owner: string, name: string) => Promise<void>;
  onRestoreBuiltin?: () => Promise<void>;
  onClose: () => void;
}

export function RepoManagerPanel({
  repos,
  skills,
  onAdd,
  onRemove,
  onRestoreBuiltin,
  onClose,
}: RepoManagerPanelProps) {
  const { t, i18n } = useTranslation();
  const [repoUrl, setRepoUrl] = useState("");
  const [branch, setBranch] = useState("");
  const [error, setError] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);

  /** 根据当前语言获取仓库描述 */
  const getRepoDescription = (repo: SkillRepo): string | undefined => {
    const lang = i18n.language;
    if (lang.startsWith("zh")) {
      return repo.description_zh;
    } else if (lang.startsWith("ja")) {
      return repo.description_ja;
    }
    return repo.description_en;
  };

  const getSkillCount = (repo: SkillRepo) =>
    skills.filter(
      (skill) =>
        skill.repoOwner === repo.owner &&
        skill.repoName === repo.name &&
        (skill.repoBranch || "main") === (repo.branch || "main"),
    ).length;

  const parseRepoUrl = (
    url: string,
  ): { owner: string; name: string } | null => {
    let cleaned = url.trim();
    cleaned = cleaned.replace(/^https?:\/\/github\.com\//, "");
    cleaned = cleaned.replace(/\.git$/, "");

    const parts = cleaned.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], name: parts[1] };
    }

    return null;
  };

  const handleAdd = async () => {
    setError("");

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      setError(t("skills.repo.invalidUrl"));
      return;
    }

    try {
      await onAdd({
        owner: parsed.owner,
        name: parsed.name,
        branch: branch || "main",
        enabled: true,
        builtin: false,
        added_at: Date.now(),
      });

      setRepoUrl("");
      setBranch("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("skills.repo.addFailed"));
    }
  };

  const handleOpenRepo = async (owner: string, name: string) => {
    try {
      await settingsApi.openExternal(`https://github.com/${owner}/${name}`);
    } catch (error) {
      console.error("Failed to open URL:", error);
    }
  };

  return (
    <FullScreenPanel
      isOpen={true}
      title={t("skills.repo.title")}
      onClose={onClose}
    >
      {/* 添加仓库表单 */}
      <div className="space-y-4 glass-card rounded-xl p-6">
        <h3 className="text-base font-semibold text-foreground">
          {t("skills.addRepo")}
        </h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="repo-url" className="text-foreground">
              {t("skills.repo.url")}
            </Label>
            <Input
              id="repo-url"
              placeholder={t("skills.repo.urlPlaceholder")}
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="branch" className="text-foreground">
              {t("skills.repo.branch")}
            </Label>
            <Input
              id="branch"
              placeholder={t("skills.repo.branchPlaceholder")}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="mt-2"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button
            onClick={handleAdd}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            type="button"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("skills.repo.add")}
          </Button>
        </div>
      </div>

      {/* 仓库列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            {t("skills.repo.list")}
          </h3>
          {onRestoreBuiltin && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsRestoring(true);
                try {
                  await onRestoreBuiltin();
                } finally {
                  setIsRestoring(false);
                }
              }}
              disabled={isRestoring}
              className="text-xs"
            >
              <RotateCcw
                className={`h-3.5 w-3.5 mr-1.5 ${isRestoring ? "animate-spin" : ""}`}
              />
              {t("skills.repo.restoreBuiltin")}
            </Button>
          )}
        </div>
        {repos.length === 0 ? (
          <div className="text-center py-12 glass-card rounded-xl">
            <p className="text-sm text-muted-foreground">
              {t("skills.repo.empty")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {repos.map((repo) => {
              const description = getRepoDescription(repo);
              return (
                <div
                  key={`${repo.owner}/${repo.name}`}
                  className="flex items-center justify-between glass-card rounded-xl px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {repo.owner}/{repo.name}
                      </span>
                      {repo.builtin && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {t("skills.repo.builtin")}
                        </Badge>
                      )}
                    </div>
                    {description && (
                      <div className="mt-0.5 text-xs text-muted-foreground truncate">
                        {description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("skills.repo.branch")}: {repo.branch || "main"}
                      <span className="ml-3 inline-flex items-center rounded-full border border-border-default px-2 py-0.5 text-[11px]">
                        {t("skills.repo.skillCount", {
                          count: getSkillCount(repo),
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={() => handleOpenRepo(repo.owner, repo.name)}
                      title={t("common.view", { defaultValue: "查看" })}
                      className="hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {!repo.builtin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={() => onRemove(repo.owner, repo.name)}
                        title={t("common.delete")}
                        className="hover:text-red-500 hover:bg-red-100 dark:hover:text-red-400 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FullScreenPanel>
  );
}
