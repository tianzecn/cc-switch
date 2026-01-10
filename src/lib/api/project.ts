import { invoke } from "@tauri-apps/api/core";

// ========== 类型定义 ==========

/** 项目信息 */
export interface ProjectInfo {
  /** 项目完整路径 */
  path: string;
  /** 项目名称（目录名） */
  name: string;
  /** 最后使用时间（ISO 8601 格式） */
  lastUsed: string | null;
  /** 路径是否有效（目录存在） */
  isValid: boolean;
}

// ========== API ==========

export const projectApi = {
  /**
   * 获取所有 Claude Code 项目
   *
   * 从 `~/.claude/projects/` 目录读取用户使用过的项目列表，
   * 按最后使用时间降序排列
   */
  async getAll(): Promise<ProjectInfo[]> {
    return await invoke("get_all_projects");
  },
};
