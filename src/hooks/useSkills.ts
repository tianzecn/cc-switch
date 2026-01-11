import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  skillsApi,
  type AppType,
  type DiscoverableSkill,
  type InstalledSkill,
  type SkillConflict,
} from "@/lib/api/skills";

/**
 * 查询所有已安装的 Skills
 */
export function useInstalledSkills() {
  return useQuery({
    queryKey: ["skills", "installed"],
    queryFn: () => skillsApi.getInstalled(),
  });
}

/**
 * 发现可安装的 Skills（从仓库获取）
 */
export function useDiscoverableSkills() {
  return useQuery({
    queryKey: ["skills", "discoverable"],
    queryFn: () => skillsApi.discoverAvailable(),
    staleTime: Infinity, // 无限缓存，直到仓库变化时 invalidate
  });
}

/**
 * 安装 Skill
 */
export function useInstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      skill,
      currentApp,
      scope,
      projectPath,
    }: {
      skill: DiscoverableSkill;
      currentApp: AppType;
      scope?: "global" | "project";
      projectPath?: string;
    }) => skillsApi.installUnified(skill, currentApp, scope, projectPath),
    onSuccess: () => {
      // 只刷新已安装列表，不刷新可发现列表（避免重新扫描仓库）
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 卸载 Skill
 */
export function useUninstallSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => skillsApi.uninstallUnified(id),
    onSuccess: () => {
      // 只刷新已安装列表，不刷新可发现列表（避免重新扫描仓库）
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 批量卸载 Skills
 */
export function useUninstallSkillsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => skillsApi.uninstallBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 切换 Skill 在特定应用的启用状态
 */
export function useToggleSkillApp() {
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
    }) => skillsApi.toggleApp(id, app, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 修改 Skill 安装范围
 */
export function useChangeSkillScope() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      scope,
      projectPath,
      currentApp,
    }: {
      id: string;
      scope: "global" | "project";
      projectPath?: string;
      currentApp: AppType;
    }) => skillsApi.changeScope(id, scope, projectPath, currentApp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
    },
  });
}

/**
 * 扫描未管理的 Skills
 */
export function useScanUnmanagedSkills() {
  return useQuery({
    queryKey: ["skills", "unmanaged"],
    queryFn: () => skillsApi.scanUnmanaged(),
    enabled: false, // 手动触发
  });
}

/**
 * 从应用目录导入 Skills
 */
export function useImportSkillsFromApps() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (directories: string[]) =>
      skillsApi.importFromApps(directories),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "unmanaged"] });
    },
  });
}

/**
 * 获取仓库列表
 */
export function useSkillRepos() {
  return useQuery({
    queryKey: ["skills", "repos"],
    queryFn: () => skillsApi.getRepos(),
  });
}

/**
 * 添加仓库
 */
export function useAddSkillRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: skillsApi.addRepo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "repos"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "discoverable"] });
    },
  });
}

/**
 * 删除仓库
 */
export function useRemoveSkillRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ owner, name }: { owner: string; name: string }) =>
      skillsApi.removeRepo(owner, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "repos"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "discoverable"] });
    },
  });
}

/**
 * 恢复内置仓库
 */
export function useRestoreBuiltinSkillRepos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => skillsApi.restoreBuiltinRepos(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills", "repos"] });
      queryClient.invalidateQueries({ queryKey: ["skills", "discoverable"] });
    },
  });
}

// ========== 命名空间管理 (v3.12.0+) ==========

/**
 * 查询所有命名空间
 */
export function useSkillNamespaces() {
  return useQuery({
    queryKey: ["skills", "namespaces"],
    queryFn: () => skillsApi.getNamespaces(),
  });
}

/**
 * 按命名空间查询 Skills
 */
export function useSkillsByNamespace(namespace: string | null) {
  return useQuery({
    queryKey: ["skills", "byNamespace", namespace],
    queryFn: () => skillsApi.getByNamespace(namespace ?? ""),
    enabled: namespace !== null,
  });
}

/**
 * 检测 Skill 冲突
 */
export function useSkillConflicts() {
  return useQuery({
    queryKey: ["skills", "conflicts"],
    queryFn: () => skillsApi.detectConflicts(),
  });
}

/**
 * 获取 Skill 内容（SKILL.md）
 */
export function useSkillContent(id: string | null) {
  return useQuery({
    queryKey: ["skills", "content", id],
    queryFn: () => skillsApi.getContent(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 分钟缓存
  });
}

// ========== 辅助类型 ==========

export type { InstalledSkill, DiscoverableSkill, AppType, SkillConflict };
