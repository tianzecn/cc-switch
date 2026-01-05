import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Search,
  Download,
  Check,
  Loader2,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDiscoverableCommands,
  useInstalledCommands,
  useInstallCommand,
  useCommandRepos,
  useAddCommandRepo,
  useRemoveCommandRepo,
  commandKeys,
  type DiscoverableCommand,
  type CommandRepo,
} from "@/hooks/useCommands";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { CommandRepoManager } from "./CommandRepoManager";

interface CommandDiscoveryProps {
  onBack: () => void;
}

/**
 * 命令发现页面
 * 从仓库发现并安装可用的 Commands
 */
export const CommandDiscovery: React.FC<CommandDiscoveryProps> = ({
  onBack,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showRepoManager, setShowRepoManager] = useState(false);

  // Queries
  const {
    data: discoverableCommands,
    isLoading,
    refetch,
    isFetching,
  } = useDiscoverableCommands();
  const { data: installedCommands } = useInstalledCommands();
  const { data: repos = [] } = useCommandRepos();
  const installMutation = useInstallCommand();
  const addRepoMutation = useAddCommandRepo();
  const removeRepoMutation = useRemoveCommandRepo();

  // 已安装的命令 ID 集合
  const installedIds = useMemo(() => {
    if (!installedCommands) return new Set<string>();
    return new Set(installedCommands.map((cmd) => cmd.id));
  }, [installedCommands]);

  // 获取所有分类
  const categories = useMemo(() => {
    if (!discoverableCommands) return [];
    const cats = new Set<string>();
    discoverableCommands.forEach((cmd) => {
      if (cmd.category) cats.add(cmd.category);
    });
    return Array.from(cats).sort();
  }, [discoverableCommands]);

  // 筛选命令
  const filteredCommands = useMemo(() => {
    if (!discoverableCommands) return [];

    return discoverableCommands.filter((cmd) => {
      // 搜索过滤
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesName = cmd.name.toLowerCase().includes(query);
        const matchesDesc = cmd.description.toLowerCase().includes(query);
        const matchesKey = cmd.key.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc && !matchesKey) return false;
      }

      // 分类过滤
      if (categoryFilter !== "all") {
        if (cmd.category !== categoryFilter) return false;
      }

      return true;
    });
  }, [discoverableCommands, searchQuery, categoryFilter]);

  const handleInstall = async (command: DiscoverableCommand) => {
    try {
      await installMutation.mutateAsync({
        command,
        currentApp: "claude", // 默认安装时启用 Claude
      });
      toast.success(t("commands.installSuccess", { name: command.name }), {
        closeButton: true,
      });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    await refetch();
  };

  // 仓库管理
  const handleAddRepo = async (repo: CommandRepo) => {
    await addRepoMutation.mutateAsync(repo);
    toast.success(t("commands.repo.addSuccess"), { closeButton: true });
  };

  const handleRemoveRepo = async (owner: string, name: string) => {
    await removeRepoMutation.mutateAsync({ owner, name });
    toast.success(t("commands.repo.removeSuccess"), { closeButton: true });
  };

  return (
    <div className="mx-auto max-w-[72rem] px-6 flex flex-col h-[calc(100vh-8rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-4 py-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">
            {t("commands.discoverTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("commands.discoverSubtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowRepoManager(true)}
        >
          <Settings size={16} />
          <span className="ml-2">{t("commands.repo.manage")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isFetching}
        >
          <RefreshCw size={16} className={isFetching ? "animate-spin" : ""} />
          <span className="ml-2">{t("common.refresh")}</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-4 mb-4">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder={t("commands.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder={t("commands.allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("commands.allCategories")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 py-3 glass rounded-xl border border-white/10 mb-4 px-6">
        <div className="text-sm text-muted-foreground">
          {t("commands.available", { count: filteredCommands.length })} ·{" "}
          {t("commands.installedCount", { count: installedIds.size })}
        </div>
      </div>

      {/* Commands Grid */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <Loader2 size={24} className="animate-spin mr-2" />
            {t("commands.loadingDiscoverable")}
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">
              {t("commands.noDiscoverable")}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t("commands.noDiscoverableDescription")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCommands.map((command) => (
              <DiscoverableCommandCard
                key={command.key}
                command={command}
                isInstalled={installedIds.has(
                  command.namespace
                    ? `${command.namespace}/${command.filename}`
                    : command.filename
                )}
                isInstalling={
                  installMutation.isPending &&
                  installMutation.variables?.command.key === command.key
                }
                onInstall={() => handleInstall(command)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 仓库管理面板 */}
      {showRepoManager && (
        <CommandRepoManager
          repos={repos}
          commands={discoverableCommands || []}
          onAdd={handleAddRepo}
          onRemove={handleRemoveRepo}
          onClose={() => setShowRepoManager(false)}
        />
      )}
    </div>
  );
};

/**
 * 可发现命令卡片
 */
interface DiscoverableCommandCardProps {
  command: DiscoverableCommand;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const DiscoverableCommandCard: React.FC<DiscoverableCommandCardProps> = ({
  command,
  isInstalled,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();

  const commandId = command.namespace
    ? `${command.namespace}/${command.filename}`
    : command.filename;

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-colors">
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium text-foreground">{commandId}</h3>
          {command.category && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
              {command.category}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
          {command.description}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {command.repoOwner}/{command.repoName}
        </p>
      </div>

      {/* Install Button */}
      <div className="flex-shrink-0">
        {isInstalled ? (
          <Button variant="outline" size="sm" disabled className="gap-1">
            <Check size={14} />
            {t("commands.installed")}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onInstall}
            disabled={isInstalling}
            className="gap-1"
          >
            {isInstalling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            {t("commands.install")}
          </Button>
        )}
      </div>
    </div>
  );
};

export default CommandDiscovery;
