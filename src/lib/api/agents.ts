import { invoke } from "@tauri-apps/api/core";

// ========== 类型定义 ==========

export type AppType = "claude" | "codex" | "gemini";

/** Agent 应用启用状态 */
export interface AgentApps {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
}

/** 已安装的 Agent（v3.11.0+ 统一结构） */
export interface InstalledAgent {
  id: string; // "namespace/filename" 或 "filename"
  name: string;
  description?: string;
  namespace: string; // 空字符串表示根命名空间
  filename: string;
  model?: string;
  tools?: string[];
  extraMetadata?: Record<string, unknown>;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  readmeUrl?: string;
  sourcePath?: string;
  apps: AgentApps;
  fileHash?: string;
  installedAt: number;
}

/** 可发现的 Agent（来自仓库） */
export interface DiscoverableAgent {
  key: string;
  name: string;
  description: string;
  namespace: string;
  filename: string;
  model?: string;
  tools?: string[];
  readmeUrl?: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
}

/** 命名空间信息 */
export interface AgentNamespace {
  name: string; // 命名空间名称，根为 ""
  displayName: string; // 显示名称
  agentCount: number;
}

/** 未管理的 Agent（用于导入） */
export interface UnmanagedAgent {
  id: string;
  name: string;
  description?: string;
  namespace: string;
  filename: string;
  foundIn: string[]; // 发现于哪些应用目录
}

/** 仓库配置（与 Commands 共用） */
export interface CommandRepo {
  owner: string;
  name: string;
  branch: string;
  enabled: boolean;
}

/** 变更事件类型 */
export type ChangeEventType =
  | "ssotModified"
  | "ssotDeleted"
  | "ssotAdded"
  | "appConflict";

/** 变更事件 */
export interface ChangeEvent {
  id: string;
  eventType: ChangeEventType;
  app?: string;
  details?: string;
}

/** 冲突解决选项 */
export type ConflictResolution = "keepSsot" | "keepApp";

// ========== API ==========

export const agentsApi = {
  // ========== 统一管理 API (v3.11.0+) ==========

  /** 获取所有已安装的 Agents */
  async getInstalled(): Promise<InstalledAgent[]> {
    return await invoke("get_installed_agents");
  },

  /** 获取所有命名空间 */
  async getNamespaces(): Promise<AgentNamespace[]> {
    return await invoke("get_agent_namespaces");
  },

  /** 安装 Agent（统一安装） */
  async installUnified(
    agent: DiscoverableAgent,
    currentApp: AppType,
  ): Promise<InstalledAgent> {
    return await invoke("install_agent_unified", { agent, currentApp });
  },

  /** 卸载 Agent（统一卸载） */
  async uninstallUnified(id: string): Promise<boolean> {
    return await invoke("uninstall_agent_unified", { id });
  },

  /** 批量卸载 Agents */
  async uninstallBatch(ids: string[]): Promise<number> {
    return await invoke("uninstall_agents_batch", { ids });
  },

  /** 切换 Agent 的应用启用状态 */
  async toggleApp(
    id: string,
    app: AppType,
    enabled: boolean,
  ): Promise<boolean> {
    return await invoke("toggle_agent_app", { id, app, enabled });
  },

  /** 创建命名空间 */
  async createNamespace(namespace: string): Promise<boolean> {
    return await invoke("create_agent_namespace", { namespace });
  },

  /** 删除命名空间 */
  async deleteNamespace(namespace: string): Promise<boolean> {
    return await invoke("delete_agent_namespace", { namespace });
  },

  /** 扫描未管理的 Agents */
  async scanUnmanaged(): Promise<UnmanagedAgent[]> {
    return await invoke("scan_unmanaged_agents");
  },

  /** 从应用目录导入 Agents */
  async importFromApps(agentIds: string[]): Promise<InstalledAgent[]> {
    return await invoke("import_agents_from_apps", { agentIds });
  },

  /**
   * 发现可安装的 Agents（从仓库获取，带缓存支持）
   * @param forceRefresh 是否强制刷新（跳过缓存）
   */
  async discoverAvailable(forceRefresh = false): Promise<DiscoverableAgent[]> {
    return await invoke("discover_available_agents", { forceRefresh });
  },

  // ========== 文件操作 API ==========

  /** 获取 Agent 文件内容 */
  async getContent(id: string): Promise<string> {
    return await invoke("get_agent_content", { id });
  },

  /** 在外部编辑器中打开 Agent */
  async openInEditor(id: string): Promise<boolean> {
    return await invoke("open_agent_in_editor", { id });
  },

  /** 检查应用是否支持 Agents 功能 */
  async checkAppSupport(app: AppType): Promise<boolean> {
    return await invoke("check_app_agents_support_cmd", { app });
  },

  // ========== 仓库管理 API（与 Commands 共用表） ==========

  /** 获取仓库列表 */
  async getRepos(): Promise<CommandRepo[]> {
    return await invoke("get_agent_repos");
  },

  /** 添加仓库 */
  async addRepo(repo: CommandRepo): Promise<boolean> {
    return await invoke("add_agent_repo", { repo });
  },

  /** 删除仓库 */
  async removeRepo(owner: string, name: string): Promise<boolean> {
    return await invoke("remove_agent_repo", { owner, name });
  },

  /**
   * 清除 Agents 发现缓存
   * @param owner 仓库所有者（可选，不提供则清除全部）
   * @param name 仓库名称（可选，与 owner 一起使用）
   * @returns 清除的缓存条目数
   */
  async clearCache(owner?: string, name?: string): Promise<number> {
    return await invoke("clear_agent_cache", { owner, name });
  },

  // ========== 变更检测 API ==========

  /** 检测 Agents 变更 */
  async detectChanges(): Promise<ChangeEvent[]> {
    return await invoke("detect_agent_changes");
  },

  /** 解决 Agent 冲突 */
  async resolveConflict(
    id: string,
    app: AppType,
    resolution: ConflictResolution,
  ): Promise<boolean> {
    return await invoke("resolve_agent_conflict", { id, app, resolution });
  },

  /** 从 SSOT 刷新 Agents 到数据库 */
  async refreshFromSsot(): Promise<number> {
    return await invoke("refresh_agents_from_ssot");
  },

  /** 同步所有 Agents 到应用目录 */
  async syncToApps(): Promise<number> {
    return await invoke("sync_agents_to_apps");
  },
};
