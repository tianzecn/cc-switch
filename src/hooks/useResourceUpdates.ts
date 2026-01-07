import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  updateApi,
  type BatchCheckResult,
  type BatchUpdateResult,
  type RateLimitInfo,
  type ResourceType,
  type SkillUpdateResult,
  type UpdateCheckResult,
} from "@/lib/api/update";

// ========== 更新检测 Hooks ==========

/**
 * 检查 Skills 更新
 * 默认禁用自动查询，需要手动触发
 */
export function useCheckSkillsUpdates() {
  return useQuery({
    queryKey: ["updates", "skills"],
    queryFn: () => updateApi.checkSkillsUpdates(),
    enabled: false, // 手动触发
    staleTime: 0, // 不缓存，每次都重新请求
  });
}

/**
 * 检查单个 Skill 更新
 */
export function useCheckSkillUpdate(skillId: string, enabled = false) {
  return useQuery({
    queryKey: ["updates", "skill", skillId],
    queryFn: () => updateApi.checkSkillUpdate(skillId),
    enabled,
    staleTime: 0,
  });
}

/**
 * 检查 Commands 更新
 */
export function useCheckCommandsUpdates() {
  return useQuery({
    queryKey: ["updates", "commands"],
    queryFn: () => updateApi.checkCommandsUpdates(),
    enabled: false,
    staleTime: 0,
  });
}

/**
 * 检查 Hooks 更新
 */
export function useCheckHooksUpdates() {
  return useQuery({
    queryKey: ["updates", "hooks"],
    queryFn: () => updateApi.checkHooksUpdates(),
    enabled: false,
    staleTime: 0,
  });
}

/**
 * 检查 Agents 更新
 */
export function useCheckAgentsUpdates() {
  return useQuery({
    queryKey: ["updates", "agents"],
    queryFn: () => updateApi.checkAgentsUpdates(),
    enabled: false,
    staleTime: 0,
  });
}

/**
 * 通用资源类型更新检测
 * 根据资源类型返回对应的查询 key
 */
export function useCheckResourceUpdates(resourceType: ResourceType) {
  return useQuery({
    queryKey: ["updates", resourceType],
    queryFn: () => updateApi.checkResourceUpdates(resourceType),
    enabled: false,
    staleTime: 0,
  });
}

// ========== GitHub Token 管理 Hooks ==========

/**
 * 获取 GitHub Token 状态
 */
export function useGitHubTokenStatus() {
  return useQuery({
    queryKey: ["github", "tokenStatus"],
    queryFn: () => updateApi.getGitHubTokenStatus(),
    staleTime: Infinity, // Token 状态不会经常变化
  });
}

/**
 * 验证 GitHub Token
 */
export function useValidateGitHubToken() {
  return useMutation({
    mutationFn: (token: string) => updateApi.validateGitHubToken(token),
  });
}

/**
 * 保存 GitHub Token
 */
export function useSaveGitHubToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token?: string) => updateApi.saveGitHubToken(token),
    onSuccess: () => {
      // 刷新 Token 状态
      queryClient.invalidateQueries({ queryKey: ["github", "tokenStatus"] });
    },
  });
}

// ========== 更新执行 Hooks ==========

/**
 * 更新单个 Skill
 * 成功后自动刷新 Skills 列表和清除更新检测结果
 */
export function useUpdateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => updateApi.updateSkill(skillId),
    onSuccess: () => {
      // 刷新 Skills 列表
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      // 清除更新检测结果（因为 enabled: false，invalidate 不会重新获取）
      queryClient.removeQueries({ queryKey: ["updates", "skills"] });
    },
  });
}

/**
 * 批量更新 Skills
 * 成功后自动刷新 Skills 列表和清除更新检测结果
 */
export function useUpdateSkillsBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillIds: string[]) => updateApi.updateSkillsBatch(skillIds),
    onSuccess: () => {
      // 刷新 Skills 列表
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      // 清除更新检测结果（因为 enabled: false，invalidate 不会重新获取）
      // 直接移除缓存，这样徽章就不会显示了
      queryClient.removeQueries({ queryKey: ["updates", "skills"] });
    },
  });
}

/**
 * 修复缺少 file_hash 的 Skills
 * 用于修复旧版本安装的 Skills 的更新检测
 */
export function useFixSkillsHash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => updateApi.fixSkillsHash(),
    onSuccess: () => {
      // 刷新 Skills 列表
      queryClient.invalidateQueries({ queryKey: ["skills"] });
      // 刷新更新检测结果
      queryClient.invalidateQueries({ queryKey: ["updates", "skills"] });
    },
  });
}

// ========== 辅助 Hooks ==========

/**
 * 使用更新检测结果进行筛选
 * 返回有更新的资源 ID 列表
 */
export function useUpdatableResourceIds(result?: BatchCheckResult): string[] {
  if (!result) return [];
  return result.results
    .filter((r) => r.hasUpdate && !r.error)
    .map((r) => r.id);
}

/**
 * 从批量结果中获取指定资源的更新状态
 */
export function getResourceUpdateStatus(
  result: BatchCheckResult | undefined,
  resourceId: string,
): UpdateCheckResult | undefined {
  if (!result) return undefined;
  return result.results.find((r) => r.id === resourceId);
}

/**
 * 检查是否有任何可更新的资源
 */
export function hasAnyUpdates(result?: BatchCheckResult): boolean {
  return (result?.updateCount ?? 0) > 0;
}

/**
 * 检查是否有远程已删除的资源
 */
export function hasDeletedResources(result?: BatchCheckResult): boolean {
  return (result?.deletedCount ?? 0) > 0;
}

// ========== 类型导出 ==========

export type {
  BatchCheckResult,
  BatchUpdateResult,
  RateLimitInfo,
  ResourceType,
  SkillUpdateResult,
  UpdateCheckResult,
};
