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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  // 选中的命名空间及其命令列表
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(
    null,
  );
  const [namespaceCommands, setNamespaceCommands] = useState<
    DiscoverableCommand[]
  >([]);

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

  // 命名空间选择处理
  const handleSelectNamespace = (
    namespaceId: string,
    commands: DiscoverableCommand[],
  ) => {
    setSelectedNamespace(namespaceId);
    setNamespaceCommands(commands);
  };

  // 检查命令是否已安装
  const isCommandInstalled = (cmd: DiscoverableCommand) => {
    const id = cmd.namespace
      ? `${cmd.namespace}/${cmd.filename}`
      : cmd.filename;
    return installedIds.has(id);
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
        {/* Left Panel - Tree Navigation */}
        <div className="w-72 flex-shrink-0 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
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
                selectedNamespace={selectedNamespace}
                onSelectNamespace={handleSelectNamespace}
                expandedNodes={expandedNodes}
                onToggleNode={handleToggleNode}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Command List */}
        <div className="flex-1 rounded-xl border border-border bg-muted/30 overflow-hidden flex flex-col">
          {selectedNamespace ? (
            <>
              <div className="flex-shrink-0 px-4 py-3 border-b border-border/50">
                <h3 className="text-sm font-medium text-foreground">
                  {selectedNamespace.split("/").slice(-1)[0]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {namespaceCommands.length} {t("commands.title").toLowerCase()}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-2">
                  {namespaceCommands.map((cmd) => (
                    <CommandListItem
                      key={cmd.key}
                      command={cmd}
                      isInstalled={isCommandInstalled(cmd)}
                      isInstalling={
                        installMutation.isPending &&
                        installMutation.variables?.command.key === cmd.key
                      }
                      onInstall={() => handleInstall(cmd)}
                    />
                  ))}
                </div>
              </div>
            </>
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
 * 命令列表项组件
 */
interface CommandListItemProps {
  command: DiscoverableCommand;
  isInstalled: boolean;
  isInstalling: boolean;
  onInstall: () => void;
}

const CommandListItem: React.FC<CommandListItemProps> = ({
  command,
  isInstalled,
  isInstalling,
  onInstall,
}) => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      {/* 头部：命令名 + 分类 + 安装按钮 */}
      <div className="flex items-start gap-3">
        <FileText
          size={16}
          className="text-muted-foreground flex-shrink-0 mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{command.name}</span>
            {command.category && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-primary/10 text-primary flex-shrink-0">
                {command.category}
              </span>
            )}
          </div>
          {/* 描述 */}
          <p className="text-xs text-muted-foreground mb-2">
            {command.description}
          </p>
          {/* 文档链接 */}
          {command.readmeUrl && (
            <a
              href={command.readmeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink size={12} />
              {t("commands.viewDocumentation")}
            </a>
          )}
        </div>

        {/* 安装按钮 */}
        <div className="flex-shrink-0">
          {isInstalled ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-600">
              <Check size={12} />
              {t("commands.installed")}
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={onInstall}
              disabled={isInstalling}
              className="h-7 text-xs gap-1"
            >
              {isInstalling ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Download size={12} />
              )}
              {t("commands.install")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandDiscovery;
