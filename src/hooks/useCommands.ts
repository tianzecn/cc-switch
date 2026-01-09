import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  commandsApi,
  type AppType,
  type DiscoverableCommand,
  type InstalledCommand,
  type CommandNamespace,
  type UnmanagedCommand,
  type CommandRepo,
  type ChangeEvent,
  type ChangeEventType,
  type ConflictResolution,
} from "@/lib/api/commands";

// ========== Query Keys ==========

export const commandKeys = {
  all: ["commands"] as const,
  installed: () => [...commandKeys.all, "installed"] as const,
  namespaces: () => [...commandKeys.all, "namespaces"] as const,
  discoverable: () => [...commandKeys.all, "discoverable"] as const,
  unmanaged: () => [...commandKeys.all, "unmanaged"] as const,
  repos: () => [...commandKeys.all, "repos"] as const,
  changes: () => [...commandKeys.all, "changes"] as const,
  content: (id: string) => [...commandKeys.all, "content", id] as const,
  appSupport: (app: AppType) =>
    [...commandKeys.all, "appSupport", app] as const,
};

// ========== Queries ==========

/**
 * 查询所有已安装的 Commands
 */
export function useInstalledCommands() {
  return useQuery({
    queryKey: commandKeys.installed(),
    queryFn: () => commandsApi.getInstalled(),
  });
}

/**
 * 查询所有命名空间
 */
export function useCommandNamespaces() {
  return useQuery({
    queryKey: commandKeys.namespaces(),
    queryFn: () => commandsApi.getNamespaces(),
  });
}

/**
 * 发现可安装的 Commands（从仓库获取，带后端缓存支持）
 *
 * 后端有 24 小时缓存机制，首次加载很快。
 * 使用 `refetch()` 时默认使用后端缓存，
 * 需要强制刷新时请使用 `useRefreshDiscoverableCommands` mutation。
 */
export function useDiscoverableCommands() {
  return useQuery({
    queryKey: commandKeys.discoverable(),
    queryFn: () => commandsApi.discoverAvailable(false),
    staleTime: 5 * 60 * 1000, // 5 分钟后标记为 stale（但后端有 24h 缓存）
  });
}

/**
 * 强制刷新可发现的 Commands（跳过后端缓存）
 *
 * 用于用户点击"刷新"按钮时，强制从 GitHub 重新获取
 */
export function useRefreshDiscoverableCommands() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => commandsApi.discoverAvailable(true),
    onSuccess: (data) => {
      // 更新查询缓存
      queryClient.setQueryData(commandKeys.discoverable(), data);
    },
  });
}

/**
 * 扫描未管理的 Commands
 */
export function useScanUnmanagedCommands() {
  return useQuery({
    queryKey: commandKeys.unmanaged(),
    queryFn: () => commandsApi.scanUnmanaged(),
    enabled: false, // 手动触发
  });
}

/**
 * 获取仓库列表
 */
export function useCommandRepos() {
  return useQuery({
    queryKey: commandKeys.repos(),
    queryFn: () => commandsApi.getRepos(),
  });
}

/**
 * 检测 Commands 变更
 */
export function useCommandChanges() {
  return useQuery({
    queryKey: commandKeys.changes(),
    queryFn: () => commandsApi.detectChanges(),
    enabled: false, // 手动触发
  });
}

/**
 * 获取 Command 文件内容
 */
export function useCommandContent(id: string) {
  return useQuery({
    queryKey: commandKeys.content(id),
    queryFn: () => commandsApi.getContent(id),
    enabled: !!id,
  });
}

/**
 * 检查应用是否支持 Commands
 */
export function useAppCommandsSupport(app: AppType) {
  return useQuery({
    queryKey: commandKeys.appSupport(app),
    queryFn: () => commandsApi.checkAppSupport(app),
    staleTime: Infinity, // 应用支持状态不会改变
  });
}

// ========== Mutations ==========

/**
 * 安装 Command
 */
export function useInstallCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      command,
      currentApp,
    }: {
      command: DiscoverableCommand;
      currentApp: AppType;
    }) => commandsApi.installUnified(command, currentApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 卸载 Command
 */
export function useUninstallCommand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => commandsApi.uninstallUnified(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 批量卸载 Commands
 */
export function useUninstallCommandsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => commandsApi.uninstallBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 切换 Command 在特定应用的启用状态
 */
export function useToggleCommandApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      app,
      enabled,
    }: {
      id: string;
      app: AppType;
      enabled: boolean;
    }) => commandsApi.toggleApp(id, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
    },
  });
}

/**
 * 创建命名空间
 */
export function useCreateNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => commandsApi.createNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
    },
  });
}

/**
 * 删除命名空间
 */
export function useDeleteNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => commandsApi.deleteNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
    },
  });
}

/**
 * 从应用目录导入 Commands
 */
export function useImportCommandsFromApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commandIds: string[]) =>
      commandsApi.importFromApps(commandIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.unmanaged() });
    },
  });
}

/**
 * 在外部编辑器中打开 Command
 */
export function useOpenCommandInEditor() {
  return useMutation({
    mutationFn: (id: string) => commandsApi.openInEditor(id),
  });
}

/**
 * 添加仓库
 */
export function useAddCommandRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repo: CommandRepo) => commandsApi.addRepo(repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.repos() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 删除仓库
 */
export function useRemoveCommandRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner: string; name: string }) =>
      commandsApi.removeRepo(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.repos() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 恢复内置仓库
 */
export function useRestoreBuiltinCommandRepos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commandsApi.restoreBuiltinRepos(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.repos() });
      queryClient.invalidateQueries({ queryKey: commandKeys.discoverable() });
    },
  });
}

/**
 * 解决 Command 冲突
 */
export function useResolveConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      app,
      resolution,
    }: {
      id: string;
      app: AppType;
      resolution: ConflictResolution;
    }) => commandsApi.resolveConflict(id, app, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.changes() });
    },
  });
}

/**
 * 从 SSOT 刷新 Commands 到数据库
 */
export function useRefreshFromSsot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commandsApi.refreshFromSsot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.installed() });
      queryClient.invalidateQueries({ queryKey: commandKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: commandKeys.changes() });
    },
  });
}

/**
 * 同步所有 Commands 到应用目录
 */
export function useSyncToApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => commandsApi.syncToApps(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commandKeys.changes() });
    },
  });
}

// ========== 辅助类型导出 ==========

export type {
  InstalledCommand,
  DiscoverableCommand,
  CommandNamespace,
  UnmanagedCommand,
  CommandRepo,
  ChangeEvent,
  ChangeEventType,
  AppType,
  ConflictResolution,
};
