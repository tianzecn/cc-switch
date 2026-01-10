import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { projectApi, type ProjectInfo } from "@/lib/api";

/**
 * 项目查询 Query Keys
 */
export const projectQueryKeys = {
  all: ["projects"] as const,
};

/**
 * 获取所有 Claude Code 项目的 Hook
 *
 * 从 `~/.claude/projects/` 目录读取用户使用过的项目列表，
 * 按最后使用时间降序排列。
 *
 * @returns UseQueryResult 包含项目列表数据
 *
 * @example
 * ```tsx
 * const { data: projects, isLoading } = useProjects();
 *
 * // 过滤有效项目
 * const validProjects = projects?.filter(p => p.isValid) ?? [];
 * ```
 */
export function useProjects(): UseQueryResult<ProjectInfo[]> {
  return useQuery({
    queryKey: projectQueryKeys.all,
    queryFn: () => projectApi.getAll(),
    // 30 秒内认为数据是新鲜的，不会重新请求
    staleTime: 30 * 1000,
    // 缓存保留 5 分钟
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * 获取有效项目的 Hook（过滤掉已删除的项目）
 *
 * @example
 * ```tsx
 * const { data: validProjects, isLoading } = useValidProjects();
 * ```
 */
export function useValidProjects(): UseQueryResult<ProjectInfo[]> {
  const query = useProjects();

  return {
    ...query,
    data: query.data?.filter((p) => p.isValid),
  } as UseQueryResult<ProjectInfo[]>;
}
