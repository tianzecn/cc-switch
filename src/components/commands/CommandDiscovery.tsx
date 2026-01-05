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
  FileText,
  ExternalLink,
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
  useRefreshDiscoverableCommands,
  type DiscoverableCommand,
  type CommandRepo,
} from "@/hooks/useCommands";
import { toast } from "sonner";
import { CommandRepoManager } from "./CommandRepoManager";
import { CommandDiscoveryTree } from "./CommandDiscoveryTree";

interface CommandDiscoveryProps {
  onBack: () => void;
}

/**
 * 命令发现页面（双栏布局）
 * 左侧：树形结构浏览（repo → namespace → commands）
 * 右侧：命令详情面板
 */
export const CommandDiscovery: React.FC<CommandDiscoveryProps> = ({
  onBack,
}) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [selectedCommand, setSelectedCommand] =
    useState<DiscoverableCommand | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Queries
  const { data: discoverableCommands, isLoading } = useDiscoverableCommands();
  const { data: installedCommands } = useInstalledCommands();
  const { data: repos = [] } = useCommandRepos();
  const installMutation = useInstallCommand();
  const addRepoMutation = useAddCommandRepo();
  const removeRepoMutation = useRemoveCommandRepo();
  const refreshMutation = useRefreshDiscoverableCommands();

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
    try {
      await refreshMutation.mutateAsync();
      toast.success(t("commands.refreshSuccess"), { closeButton: true });
    } catch (error) {
      toast.error(t("common.error"), {
        description: String(error),
      });
    }
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

  const handleToggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const handleSelectCommand = (command: DiscoverableCommand) => {
    setSelectedCommand(command);
  };

  // 检查选中的命令是否已安装
  const isSelectedInstalled = useMemo(() => {
    if (!selectedCommand) return false;
    const id = selectedCommand.namespace
      ? `${selectedCommand.namespace}/${selectedCommand.filename}`
      : selectedCommand.filename;
    return installedIds.has(id);
  }, [selectedCommand, installedIds]);

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
          disabled={refreshMutation.isPending}
        >
          <RefreshCw
            size={16}
            className={refreshMutation.isPending ? "animate-spin" : ""}
          />
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

      {/* Main Content - 双栏布局 */}
      <div className="flex-1 flex gap-4 overflow-hidden pb-4">
        {/* Left Panel - Tree */}
        <div className="w-80 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
            <h3 className="text-sm font-medium text-muted-foreground">
              {t("commands.browseByRepo")}
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                <Loader2 size={20} className="animate-spin mr-2" />
                {t("commands.loadingDiscoverable")}
              </div>
            ) : (
              <CommandDiscoveryTree
                commands={filteredCommands}
                installedIds={installedIds}
                selectedKey={selectedCommand?.key ?? null}
                onSelectCommand={handleSelectCommand}
                expandedNodes={expandedNodes}
                onToggleNode={handleToggleNode}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Detail */}
        <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          {selectedCommand ? (
            <CommandDetailPanel
              command={selectedCommand}
              isInstalled={isSelectedInstalled}
              isInstalling={
                installMutation.isPending &&
                installMutation.variables?.command.key === selectedCommand.key
              }
              onInstall={() => handleInstall(selectedCommand)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <FileText size={48} className="mb-4 opacity-30" />
              <p className="text-sm">{t("commands.selectToView")}</p>
            </div>
          )}
        </div>
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
 * 命令详情面板
 */
interface CommandDetailPanelProps {
  command: DiscoverableCommand;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const CommandDetailPanel: React.FC<CommandDetailPanelProps> = ({
  command,
  isInstalled,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();

  const commandId = command.namespace
    ? `${command.namespace}/${command.filename}`
    : command.filename;

  const repoUrl = `https://github.com/${command.repoOwner}/${command.repoName}`;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-foreground truncate">
                {commandId}
              </h2>
              {command.category && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary flex-shrink-0">
                  {command.category}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{command.name}</p>
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Description */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">
            {t("commands.description")}
          </h3>
          <p className="text-sm text-muted-foreground">{command.description}</p>
        </div>

        {/* Metadata */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-foreground">
            {t("commands.metadata")}
          </h3>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-muted-foreground">{t("commands.source")}</div>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1"
            >
              {command.repoOwner}/{command.repoName}
              <ExternalLink size={12} />
            </a>

            <div className="text-muted-foreground">{t("commands.branch")}</div>
            <div className="text-foreground">{command.repoBranch}</div>

            <div className="text-muted-foreground">
              {t("commands.namespace")}
            </div>
            <div className="text-foreground">
              {command.namespace || t("commands.rootNamespace")}
            </div>

            <div className="text-muted-foreground">
              {t("commands.filename")}
            </div>
            <div className="text-foreground font-mono text-xs">
              {command.filename}.md
            </div>
          </div>
        </div>

        {/* README Link */}
        {command.readmeUrl && (
          <div>
            <a
              href={command.readmeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink size={14} />
              {t("commands.viewDocumentation")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandDiscovery;
