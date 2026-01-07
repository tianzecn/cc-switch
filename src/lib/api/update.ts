import { invoke } from "@tauri-apps/api/core";

// ========== 类型定义 ==========

/** 资源类型 */
export type ResourceType = "skill" | "command" | "hook" | "agent";

/** 单个资源的更新检测结果 */
export interface UpdateCheckResult {
  /** 资源 ID */
  id: string;
  /** 是否有更新 */
  hasUpdate: boolean;
  /** 新的 hash（如果有更新） */
  newHash?: string;
  /** 最新 commit 消息 */
  commitMessage?: string;
  /** 更新时间（Unix 时间戳） */
  updatedAt?: number;
  /** 错误信息（如果检测失败） */
  error?: string;
  /** 远程是否已删除 */
  remoteDeleted: boolean;
}

/** 批量更新检测结果 */
export interface BatchCheckResult {
  /** 成功检测的数量 */
  successCount: number;
  /** 失败的数量 */
  failedCount: number;
  /** 有更新的数量 */
  updateCount: number;
  /** 远程已删除的数量 */
  deletedCount: number;
  /** 各资源的检测结果 */
  results: UpdateCheckResult[];
}

/** GitHub API 速率限制信息 */
export interface RateLimitInfo {
  /** 剩余请求次数 */
  remaining: number;
  /** 总配额 */
  limit: number;
  /** 重置时间（Unix 时间戳） */
  resetAt: number;
}

/** 单个 Skill 更新执行结果 */
export interface SkillUpdateResult {
  /** Skill ID */
  id: string;
  /** 是否成功 */
  success: boolean;
  /** 新的 hash（如果成功） */
  newHash?: string;
  /** 错误信息（如果失败） */
  error?: string;
}

/** 单个资源更新执行结果 */
export interface UpdateExecuteResult {
  /** 资源 ID */
  id: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
}

/** 批量更新执行结果 */
export interface BatchUpdateResult {
  /** 成功数量 */
  successCount: number;
  /** 失败数量 */
  failedCount: number;
  /** 各资源的更新结果 */
  results: UpdateExecuteResult[];
}

// ========== API ==========

export const updateApi = {
  // ========== 更新检测 ==========

  /** 检查所有 Skills 的更新 */
  async checkSkillsUpdates(): Promise<BatchCheckResult> {
    return await invoke("check_skills_updates");
  },

  /** 检查单个 Skill 的更新 */
  async checkSkillUpdate(skillId: string): Promise<UpdateCheckResult> {
    return await invoke("check_skill_update", { skillId });
  },

  /** 检查所有 Commands 的更新 */
  async checkCommandsUpdates(): Promise<BatchCheckResult> {
    return await invoke("check_commands_updates");
  },

  /** 检查所有 Hooks 的更新 */
  async checkHooksUpdates(): Promise<BatchCheckResult> {
    return await invoke("check_hooks_updates");
  },

  /** 检查所有 Agents 的更新 */
  async checkAgentsUpdates(): Promise<BatchCheckResult> {
    return await invoke("check_agents_updates");
  },

  /** 检查指定资源类型的更新 */
  async checkResourceUpdates(
    resourceType: ResourceType,
  ): Promise<BatchCheckResult> {
    return await invoke("check_resource_updates", { resourceType });
  },

  // ========== GitHub Token 管理 ==========

  /** 验证 GitHub Token */
  async validateGitHubToken(token: string): Promise<RateLimitInfo> {
    return await invoke("validate_github_token", { token });
  },

  /** 保存 GitHub Token */
  async saveGitHubToken(token?: string): Promise<void> {
    return await invoke("save_github_token", { token });
  },

  /** 获取 GitHub Token 状态（脱敏） */
  async getGitHubTokenStatus(): Promise<string | null> {
    return await invoke("get_github_token_status");
  },

  // ========== 更新执行 ==========

  /** 更新单个 Skill */
  async updateSkill(skillId: string): Promise<SkillUpdateResult> {
    return await invoke("update_skill", { skillId });
  },

  /** 批量更新 Skills */
  async updateSkillsBatch(skillIds: string[]): Promise<BatchUpdateResult> {
    return await invoke("update_skills_batch", { skillIds });
  },

  // ========== 修复工具 ==========

  /** 修复缺少 file_hash 的 Skills（用于更新检测） */
  async fixSkillsHash(): Promise<BatchUpdateResult> {
    return await invoke("fix_skills_hash");
  },
};
