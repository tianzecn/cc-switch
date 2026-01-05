import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  hooksApi,
  type AppType,
  type DiscoverableHook,
  type InstalledHook,
  type HookNamespace,
  type UnmanagedHook,
  type CommandRepo,
  type HookEventType,
  type HookType,
  type HookRule,
  type HookApps,
} from "@/lib/api/hooks";

// ========== Query Keys ==========

export const hookKeys = {
  all: ["hooks"] as const,
  installed: () => [...hookKeys.all, "installed"] as const,
  namespaces: () => [...hookKeys.all, "namespaces"] as const,
  discoverable: () => [...hookKeys.all, "discoverable"] as const,
  unmanaged: () => [...hookKeys.all, "unmanaged"] as const,
  repos: () => [...hookKeys.all, "repos"] as const,
  content: (id: string) => [...hookKeys.all, "content", id] as const,
  appSupport: (app: AppType) => [...hookKeys.all, "appSupport", app] as const,
  byEvent: (event: HookEventType) =>
    [...hookKeys.all, "byEvent", event] as const,
};

// ========== Queries ==========

/**
 * 查询所有已安装的 Hooks
 */
export function useInstalledHooks() {
  return useQuery({
    queryKey: hookKeys.installed(),
    queryFn: () => hooksApi.getInstalled(),
  });
}

/**
 * 查询所有命名空间
 */
export function useHookNamespaces() {
  return useQuery({
    queryKey: hookKeys.namespaces(),
    queryFn: () => hooksApi.getNamespaces(),
  });
}

/**
 * 发现可安装的 Hooks（从仓库获取，带后端缓存支持）
 *
 * 后端有 24 小时缓存机制，首次加载很快。
 * 使用 `refetch()` 时默认使用后端缓存，
 * 需要强制刷新时请使用 `useRefreshDiscoverableHooks` mutation。
 */
export function useDiscoverableHooks() {
  return useQuery({
    queryKey: hookKeys.discoverable(),
    queryFn: () => hooksApi.discoverAvailable(false),
    staleTime: 5 * 60 * 1000, // 5 分钟后标记为 stale（但后端有 24h 缓存）
  });
}

/**
 * 强制刷新可发现的 Hooks（跳过后端缓存）
 *
 * 用于用户点击"刷新"按钮时，强制从 GitHub 重新获取
 */
export function useRefreshDiscoverableHooks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => hooksApi.discoverAvailable(true),
    onSuccess: (data) => {
      // 更新查询缓存
      queryClient.setQueryData(hookKeys.discoverable(), data);
    },
  });
}

/**
 * 扫描未管理的 Hooks
 */
export function useScanUnmanagedHooks() {
  return useQuery({
    queryKey: hookKeys.unmanaged(),
    queryFn: () => hooksApi.scanUnmanaged(),
    enabled: false, // 手动触发
  });
}

/**
 * 获取仓库列表（与 Commands/Agents 共用）
 */
export function useHookRepos() {
  return useQuery({
    queryKey: hookKeys.repos(),
    queryFn: () => hooksApi.getRepos(),
  });
}

/**
 * 获取 Hook 文件内容
 */
export function useHookContent(id: string) {
  return useQuery({
    queryKey: hookKeys.content(id),
    queryFn: () => hooksApi.getContent(id),
    enabled: !!id,
  });
}

/**
 * 检查应用是否支持 Hooks
 */
export function useAppHooksSupport(app: AppType) {
  return useQuery({
    queryKey: hookKeys.appSupport(app),
    queryFn: () => hooksApi.checkAppSupport(app),
    staleTime: Infinity, // 应用支持状态不会改变
  });
}

// ========== Mutations ==========

/**
 * 安装 Hook
 */
export function useInstallHook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      hook,
      currentApp,
    }: {
      hook: DiscoverableHook;
      currentApp: AppType;
    }) => hooksApi.installUnified(hook, currentApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
      queryClient.invalidateQueries({ queryKey: hookKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: hookKeys.discoverable() });
    },
  });
}

/**
 * 卸载 Hook
 */
export function useUninstallHook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hooksApi.uninstallUnified(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
      queryClient.invalidateQueries({ queryKey: hookKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: hookKeys.discoverable() });
    },
  });
}

/**
 * 切换 Hook 的全局启用状态
 */
export function useToggleHookEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      hooksApi.toggleEnabled(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
    },
  });
}

/**
 * 切换 Hook 在特定应用的启用状态
 */
export function useToggleHookApp() {
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
    }) => hooksApi.toggleApp(id, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
    },
  });
}

/**
 * 更新 Hook 优先级
 */
export function useUpdateHookPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority: number }) =>
      hooksApi.updatePriority(id, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
    },
  });
}

/**
 * 批量重新排序 Hooks（拖拽排序）
 */
export function useReorderHooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => hooksApi.reorder(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
    },
  });
}

/**
 * 创建命名空间
 */
export function useCreateHookNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => hooksApi.createNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.namespaces() });
    },
  });
}

/**
 * 删除命名空间
 */
export function useDeleteHookNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => hooksApi.deleteNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
    },
  });
}

/**
 * 在外部编辑器中打开 Hook
 */
export function useOpenHookInEditor() {
  return useMutation({
    mutationFn: (id: string) => hooksApi.openInEditor(id),
  });
}

/**
 * 添加仓库
 */
export function useAddHookRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repo: CommandRepo) => hooksApi.addRepo(repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.repos() });
      queryClient.invalidateQueries({ queryKey: hookKeys.discoverable() });
    },
  });
}

/**
 * 删除仓库
 */
export function useRemoveHookRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner: string; name: string }) =>
      hooksApi.removeRepo(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.repos() });
      queryClient.invalidateQueries({ queryKey: hookKeys.discoverable() });
    },
  });
}

/**
 * 清除缓存
 */
export function useClearHookCache() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner?: string; name?: string } = {}) =>
      hooksApi.clearCache(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.discoverable() });
    },
  });
}

/**
 * 从 SSOT 刷新 Hooks 到数据库
 */
export function useRefreshHooksFromSsot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => hooksApi.refreshFromSsot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hookKeys.installed() });
      queryClient.invalidateQueries({ queryKey: hookKeys.namespaces() });
    },
  });
}

/**
 * 同步所有 Hooks 到应用 settings.json
 */
export function useSyncHooksToApps() {
  return useMutation({
    mutationFn: () => hooksApi.syncToApps(),
  });
}

// ========== 辅助 Hooks ==========

/**
 * 按事件类型获取 Hooks
 */
export function useHooksByEventType(eventType: HookEventType) {
  const { data: hooks, ...rest } = useInstalledHooks();

  const filteredHooks = hooks?.filter((h) => h.eventType === eventType) ?? [];

  return {
    data: filteredHooks,
    ...rest,
  };
}

/**
 * 获取已启用的 Hooks（全局启用且在指定应用启用）
 */
export function useEnabledHooks(app: AppType) {
  const { data: hooks, ...rest } = useInstalledHooks();

  const enabledHooks =
    hooks?.filter((h) => {
      if (!h.enabled) return false;
      switch (app) {
        case "claude":
          return h.apps.claude;
        case "codex":
          return h.apps.codex;
        case "gemini":
          return h.apps.gemini;
        default:
          return false;
      }
    }) ?? [];

  return {
    data: enabledHooks,
    ...rest,
  };
}

// ========== 辅助类型导出 ==========

export type {
  InstalledHook,
  DiscoverableHook,
  HookNamespace,
  UnmanagedHook,
  CommandRepo,
  HookEventType,
  HookType,
  HookRule,
  HookApps,
  AppType,
};
