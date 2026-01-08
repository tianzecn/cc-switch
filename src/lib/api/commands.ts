import { invoke } from "@tauri-apps/api/core";

// ========== 类型定义 ==========

export type AppType = "claude" | "codex" | "gemini";

/** Command 应用启用状态 */
export interface CommandApps {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
}

/** 已安装的 Command（v3.11.0+ 统一结构） */
export interface InstalledCommand {
  id: string; // "namespace/filename" 或 "filename"
  name: string;
  description?: string;
  namespace: string; // 空字符串表示根命名空间
  filename: string;
  category?: string;
  allowedTools?: string[];
  mcpServers?: string[];
  personas?: string[];
  extraMetadata?: Record<string, unknown>;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  readmeUrl?: string;
  sourcePath?: string; // 文件在仓库中的完整路径
  apps: CommandApps;
  fileHash?: string;
  installedAt: number;
}

/** 可发现的 Command（来自仓库） */
export interface DiscoverableCommand {
  key: string;
  name: string;
  description: string;
  namespace: string;
  filename: string;
  category?: string;
  readmeUrl?: string;
  repoOwner: string;
  repoName: string;
  repoBranch: string;
}

/** 命名空间信息 */
export interface CommandNamespace {
  name: string; // 命名空间名称，根为 ""
  displayName: string; // 显示名称
  commandCount: number;
}

/** 未管理的 Command（用于导入） */
export interface UnmanagedCommand {
  id: string;
  name: string;
  description?: string;
  namespace: string;
  filename: string;
  foundIn: string[]; // 发现于哪些应用目录
}

/** 仓库配置 */
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

export const commandsApi = {
  // ========== 统一管理 API (v3.11.0+) ==========

  /** 获取所有已安装的 Commands */
  async getInstalled(): Promise<InstalledCommand[]> {
    return await invoke("get_installed_commands");
  },

  /** 获取所有命名空间 */
  async getNamespaces(): Promise<CommandNamespace[]> {
    return await invoke("get_command_namespaces");
  },

  /** 安装 Command（统一安装） */
  async installUnified(
    command: DiscoverableCommand,
    currentApp: AppType,
  ): Promise<InstalledCommand> {
    return await invoke("install_command_unified", { command, currentApp });
  },

  /** 卸载 Command（统一卸载） */
  async uninstallUnified(id: string): Promise<boolean> {
    return await invoke("uninstall_command_unified", { id });
  },

  /** 批量卸载 Commands */
  async uninstallBatch(ids: string[]): Promise<number> {
    return await invoke("uninstall_commands_batch", { ids });
  },

  /** 切换 Command 的应用启用状态 */
  async toggleApp(
    id: string,
    app: AppType,
    enabled: boolean,
  ): Promise<boolean> {
    return await invoke("toggle_command_app", { id, app, enabled });
  },

  /** 创建命名空间 */
  async createNamespace(namespace: string): Promise<boolean> {
    return await invoke("create_command_namespace", { namespace });
  },

  /** 删除命名空间 */
  async deleteNamespace(namespace: string): Promise<boolean> {
    return await invoke("delete_command_namespace", { namespace });
  },

  /** 扫描未管理的 Commands */
  async scanUnmanaged(): Promise<UnmanagedCommand[]> {
    return await invoke("scan_unmanaged_commands");
  },

  /** 从应用目录导入 Commands */
  async importFromApps(commandIds: string[]): Promise<InstalledCommand[]> {
    return await invoke("import_commands_from_apps", { commandIds });
  },

  /**
   * 发现可安装的 Commands（从仓库获取，带缓存支持）
   * @param forceRefresh 是否强制刷新（跳过缓存）
   */
  async discoverAvailable(
    forceRefresh = false,
  ): Promise<DiscoverableCommand[]> {
    return await invoke("discover_available_commands", { forceRefresh });
  },

  // ========== 文件操作 API ==========

  /** 获取 Command 文件内容 */
  async getContent(id: string): Promise<string> {
    return await invoke("get_command_content", { id });
  },

  /** 在外部编辑器中打开 Command */
  async openInEditor(id: string): Promise<boolean> {
    return await invoke("open_command_in_editor", { id });
  },

  /** 检查应用是否支持 Commands 功能 */
  async checkAppSupport(app: AppType): Promise<boolean> {
    return await invoke("check_app_commands_support", { app });
  },

  // ========== 仓库管理 API ==========

  /** 获取仓库列表 */
  async getRepos(): Promise<CommandRepo[]> {
    return await invoke("get_command_repos");
  },

  /** 添加仓库 */
  async addRepo(repo: CommandRepo): Promise<boolean> {
    return await invoke("add_command_repo", { repo });
  },

  /** 删除仓库 */
  async removeRepo(owner: string, name: string): Promise<boolean> {
    return await invoke("remove_command_repo", { owner, name });
  },

  /**
   * 清除 Commands 发现缓存
   * @param owner 仓库所有者（可选，不提供则清除全部）
   * @param name 仓库名称（可选，与 owner 一起使用）
   * @returns 清除的缓存条目数
   */
  async clearCache(owner?: string, name?: string): Promise<number> {
    return await invoke("clear_command_cache", { owner, name });
  },

  // ========== 变更检测 API ==========

  /** 检测 Commands 变更 */
  async detectChanges(): Promise<ChangeEvent[]> {
    return await invoke("detect_command_changes");
  },

  /** 解决 Command 冲突 */
  async resolveConflict(
    id: string,
    app: AppType,
    resolution: ConflictResolution,
  ): Promise<boolean> {
    return await invoke("resolve_command_conflict", { id, app, resolution });
  },

  /** 从 SSOT 刷新 Commands 到数据库 */
  async refreshFromSsot(): Promise<number> {
    return await invoke("refresh_commands_from_ssot");
  },

  /** 同步所有 Commands 到应用目录 */
  async syncToApps(): Promise<number> {
    return await invoke("sync_commands_to_apps");
  },
};
