import { invoke } from "@tauri-apps/api/core";

// ========== 类型定义 ==========

export type AppType = "claude" | "codex" | "gemini";

/** Hook 应用启用状态 */
export interface HookApps {
  claude: boolean;
  codex: boolean;
  gemini: boolean;
}

/** Hook 事件类型 */
export type HookEventType =
  | "PreToolUse"
  | "PostToolUse"
  | "PermissionRequest"
  | "SessionEnd";

/** Hook 执行类型 */
export type HookType =
  | { type: "command"; command: string }
  | { type: "prompt"; prompt: string };

/** Hook 规则 */
export interface HookRule {
  matcher: string; // "Bash", "Edit|Write", "*", ""
  hooks: HookType[];
}

/** 已安装的 Hook */
export interface InstalledHook {
  id: string; // "namespace/filename" 或 "filename"
  name: string;
  description?: string;
  namespace: string; // 空字符串表示根命名空间
  filename: string; // 不含扩展名

  eventType: HookEventType;
  rules: HookRule[];

  // 状态
  enabled: boolean; // 全局启用状态
  priority: number; // 执行优先级（数字越小越先执行）

  // 仓库信息
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  readmeUrl?: string;
  sourcePath?: string;

  // 应用启用状态
  apps: HookApps;

  // 元数据
  fileHash?: string;
  installedAt: number;

  /** 安装范围：global 或 project */
  scope: "global" | "project";
  /** 项目路径（当 scope="project" 时有效） */
  projectPath?: string;
}

/** 可发现的 Hook（来自仓库） */
export interface DiscoverableHook {
  key: string; // 在仓库中的唯一标识
  name: string;
  description?: string;
  namespace: string;
  filename: string;

  eventType: HookEventType;
  rules: HookRule[];
  priority: number;

  repoOwner: string;
  repoName: string;
  repoBranch: string;
  readmeUrl?: string;
  sourcePath?: string;
}

/** 命名空间信息 */
export interface HookNamespace {
  name: string; // 命名空间名称，根为 ""
  displayName: string; // 显示名称
  hookCount: number;
}

/** 未管理的 Hook（用于导入） */
export interface UnmanagedHook {
  id: string;
  eventType: HookEventType;
  matcher: string;
  hookType: HookType;
  foundIn: string[]; // 发现于哪些应用目录
}

/** 仓库配置（与 Commands/Agents 共用） */
export interface CommandRepo {
  owner: string;
  name: string;
  branch: string;
  enabled: boolean;
  /** 是否为内置仓库 */
  builtin: boolean;
  /** 中文描述 */
  description_zh?: string;
  /** 英文描述 */
  description_en?: string;
  /** 日文描述 */
  description_ja?: string;
  /** 添加时间戳（内置仓库为 0） */
  added_at: number;
}

// ========== API ==========

export const hooksApi = {
  // ========== 统一管理 API ==========

  /** 获取所有已安装的 Hooks */
  async getInstalled(): Promise<InstalledHook[]> {
    return await invoke("get_installed_hooks");
  },

  /** 获取所有命名空间 */
  async getNamespaces(): Promise<HookNamespace[]> {
    return await invoke("get_hook_namespaces");
  },

  /** 安装 Hook（统一安装） */
  async installUnified(
    hook: DiscoverableHook,
    currentApp: AppType,
    scope?: "global" | "project",
    projectPath?: string,
  ): Promise<InstalledHook> {
    return await invoke("install_hook_unified", {
      hook,
      currentApp,
      scope,
      projectPath,
    });
  },

  /** 卸载 Hook（统一卸载） */
  async uninstallUnified(id: string): Promise<boolean> {
    return await invoke("uninstall_hook_unified", { id });
  },

  /** 切换 Hook 的全局启用状态 */
  async toggleEnabled(id: string, enabled: boolean): Promise<boolean> {
    return await invoke("toggle_hook_enabled", { id, enabled });
  },

  /** 切换 Hook 的应用启用状态 */
  async toggleApp(
    id: string,
    app: AppType,
    enabled: boolean,
  ): Promise<boolean> {
    return await invoke("toggle_hook_app", { id, app, enabled });
  },

  /** 修改 Hook 的安装范围 */
  async changeScope(
    id: string,
    scope: "global" | "project",
    projectPath: string | undefined,
    currentApp: AppType,
  ): Promise<boolean> {
    return await invoke("change_hook_scope", {
      id,
      scope,
      projectPath,
      currentApp,
    });
  },

  /** 更新 Hook 优先级 */
  async updatePriority(id: string, priority: number): Promise<boolean> {
    return await invoke("update_hook_priority", { id, priority });
  },

  /** 批量更新 Hook 优先级（拖拽排序） */
  async reorder(ids: string[]): Promise<boolean> {
    return await invoke("reorder_hooks", { ids });
  },

  /** 创建命名空间 */
  async createNamespace(namespace: string): Promise<boolean> {
    return await invoke("create_hook_namespace", { namespace });
  },

  /** 删除命名空间 */
  async deleteNamespace(namespace: string): Promise<boolean> {
    return await invoke("delete_hook_namespace", { namespace });
  },

  /** 扫描未管理的 Hooks */
  async scanUnmanaged(): Promise<UnmanagedHook[]> {
    return await invoke("scan_unmanaged_hooks");
  },

  /**
   * 发现可安装的 Hooks（从仓库获取，带缓存支持）
   * @param forceRefresh 是否强制刷新（跳过缓存）
   */
  async discoverAvailable(forceRefresh = false): Promise<DiscoverableHook[]> {
    return await invoke("discover_available_hooks", { forceRefresh });
  },

  // ========== 文件操作 API ==========

  /** 获取 Hook 文件内容 */
  async getContent(id: string): Promise<string> {
    return await invoke("get_hook_content", { id });
  },

  /** 在外部编辑器中打开 Hook */
  async openInEditor(id: string): Promise<boolean> {
    return await invoke("open_hook_in_editor", { id });
  },

  /** 检查应用是否支持 Hooks 功能 */
  async checkAppSupport(app: AppType): Promise<boolean> {
    return await invoke("check_app_hooks_support_cmd", { app });
  },

  // ========== 仓库管理 API（与 Commands/Agents 共用表） ==========

  /** 获取仓库列表 */
  async getRepos(): Promise<CommandRepo[]> {
    return await invoke("get_hook_repos");
  },

  /** 添加仓库 */
  async addRepo(repo: CommandRepo): Promise<boolean> {
    return await invoke("add_hook_repo", { repo });
  },

  /** 删除仓库 */
  async removeRepo(owner: string, name: string): Promise<boolean> {
    return await invoke("remove_hook_repo", { owner, name });
  },

  /**
   * 清除 Hooks 发现缓存
   * @param owner 仓库所有者（可选，不提供则清除全部）
   * @param name 仓库名称（可选，与 owner 一起使用）
   * @returns 清除的缓存条目数
   */
  async clearCache(owner?: string, name?: string): Promise<number> {
    return await invoke("clear_hook_cache", { owner, name });
  },

  // ========== 同步操作 API ==========

  /** 从 SSOT 刷新 Hooks 到数据库 */
  async refreshFromSsot(): Promise<number> {
    return await invoke("refresh_hooks_from_ssot");
  },

  /** 同步所有 Hooks 到应用 settings.json */
  async syncToApps(): Promise<number> {
    return await invoke("sync_hooks_to_apps");
  },
};
