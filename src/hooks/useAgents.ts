import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  agentsApi,
  type AppType,
  type DiscoverableAgent,
  type InstalledAgent,
  type AgentNamespace,
  type UnmanagedAgent,
  type CommandRepo,
  type ChangeEvent,
  type ChangeEventType,
  type ConflictResolution,
} from "@/lib/api/agents";

// ========== Query Keys ==========

export const agentKeys = {
  all: ["agents"] as const,
  installed: () => [...agentKeys.all, "installed"] as const,
  namespaces: () => [...agentKeys.all, "namespaces"] as const,
  discoverable: () => [...agentKeys.all, "discoverable"] as const,
  unmanaged: () => [...agentKeys.all, "unmanaged"] as const,
  repos: () => [...agentKeys.all, "repos"] as const,
  changes: () => [...agentKeys.all, "changes"] as const,
  content: (id: string) => [...agentKeys.all, "content", id] as const,
  appSupport: (app: AppType) => [...agentKeys.all, "appSupport", app] as const,
};

// ========== Queries ==========

/**
 * 查询所有已安装的 Agents
 */
export function useInstalledAgents() {
  return useQuery({
    queryKey: agentKeys.installed(),
    queryFn: () => agentsApi.getInstalled(),
  });
}

/**
 * 查询所有命名空间
 */
export function useAgentNamespaces() {
  return useQuery({
    queryKey: agentKeys.namespaces(),
    queryFn: () => agentsApi.getNamespaces(),
  });
}

/**
 * 发现可安装的 Agents（从仓库获取，带后端缓存支持）
 *
 * 后端有 24 小时缓存机制，首次加载很快。
 * 使用 `refetch()` 时默认使用后端缓存，
 * 需要强制刷新时请使用 `useRefreshDiscoverableAgents` mutation。
 */
export function useDiscoverableAgents() {
  return useQuery({
    queryKey: agentKeys.discoverable(),
    queryFn: () => agentsApi.discoverAvailable(false),
    staleTime: 5 * 60 * 1000, // 5 分钟后标记为 stale（但后端有 24h 缓存）
  });
}

/**
 * 强制刷新可发现的 Agents（跳过后端缓存）
 *
 * 用于用户点击"刷新"按钮时，强制从 GitHub 重新获取
 */
export function useRefreshDiscoverableAgents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => agentsApi.discoverAvailable(true),
    onSuccess: (data) => {
      // 更新查询缓存
      queryClient.setQueryData(agentKeys.discoverable(), data);
    },
  });
}

/**
 * 扫描未管理的 Agents
 */
export function useScanUnmanagedAgents() {
  return useQuery({
    queryKey: agentKeys.unmanaged(),
    queryFn: () => agentsApi.scanUnmanaged(),
    enabled: false, // 手动触发
  });
}

/**
 * 获取仓库列表（与 Commands 共用）
 */
export function useAgentRepos() {
  return useQuery({
    queryKey: agentKeys.repos(),
    queryFn: () => agentsApi.getRepos(),
  });
}

/**
 * 检测 Agents 变更
 */
export function useAgentChanges() {
  return useQuery({
    queryKey: agentKeys.changes(),
    queryFn: () => agentsApi.detectChanges(),
    enabled: false, // 手动触发
  });
}

/**
 * 获取 Agent 文件内容
 */
export function useAgentContent(id: string) {
  return useQuery({
    queryKey: agentKeys.content(id),
    queryFn: () => agentsApi.getContent(id),
    enabled: !!id,
  });
}

/**
 * 检查应用是否支持 Agents
 */
export function useAppAgentsSupport(app: AppType) {
  return useQuery({
    queryKey: agentKeys.appSupport(app),
    queryFn: () => agentsApi.checkAppSupport(app),
    staleTime: Infinity, // 应用支持状态不会改变
  });
}

// ========== Mutations ==========

/**
 * 安装 Agent
 */
export function useInstallAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      agent,
      currentApp,
    }: {
      agent: DiscoverableAgent;
      currentApp: AppType;
    }) => agentsApi.installUnified(agent, currentApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: agentKeys.discoverable() });
    },
  });
}

/**
 * 卸载 Agent
 */
export function useUninstallAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentsApi.uninstallUnified(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: agentKeys.discoverable() });
    },
  });
}

/**
 * 切换 Agent 在特定应用的启用状态
 */
export function useToggleAgentApp() {
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
    }) => agentsApi.toggleApp(id, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
    },
  });
}

/**
 * 创建命名空间
 */
export function useCreateAgentNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => agentsApi.createNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
    },
  });
}

/**
 * 删除命名空间
 */
export function useDeleteAgentNamespace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (namespace: string) => agentsApi.deleteNamespace(namespace),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
    },
  });
}

/**
 * 从应用目录导入 Agents
 */
export function useImportAgentsFromApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentIds: string[]) => agentsApi.importFromApps(agentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: agentKeys.unmanaged() });
    },
  });
}

/**
 * 在外部编辑器中打开 Agent
 */
export function useOpenAgentInEditor() {
  return useMutation({
    mutationFn: (id: string) => agentsApi.openInEditor(id),
  });
}

/**
 * 添加仓库
 */
export function useAddAgentRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repo: CommandRepo) => agentsApi.addRepo(repo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.repos() });
      queryClient.invalidateQueries({ queryKey: agentKeys.discoverable() });
    },
  });
}

/**
 * 删除仓库
 */
export function useRemoveAgentRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner: string; name: string }) =>
      agentsApi.removeRepo(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.repos() });
      queryClient.invalidateQueries({ queryKey: agentKeys.discoverable() });
    },
  });
}

/**
 * 解决 Agent 冲突
 */
export function useResolveAgentConflict() {
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
    }) => agentsApi.resolveConflict(id, app, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
      queryClient.invalidateQueries({ queryKey: agentKeys.changes() });
    },
  });
}

/**
 * 从 SSOT 刷新 Agents 到数据库
 */
export function useRefreshAgentsFromSsot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => agentsApi.refreshFromSsot(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.installed() });
      queryClient.invalidateQueries({ queryKey: agentKeys.namespaces() });
      queryClient.invalidateQueries({ queryKey: agentKeys.changes() });
    },
  });
}

/**
 * 同步所有 Agents 到应用目录
 */
export function useSyncAgentsToApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => agentsApi.syncToApps(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.changes() });
    },
  });
}

// ========== 辅助类型导出 ==========

export type {
  InstalledAgent,
  DiscoverableAgent,
  AgentNamespace,
  UnmanagedAgent,
  CommandRepo,
  ChangeEvent,
  ChangeEventType,
  AppType,
  ConflictResolution,
};
