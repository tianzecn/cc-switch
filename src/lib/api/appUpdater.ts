/**
 * 应用程序自动升级 API
 *
 * 封装后端 app_updater 命令，提供应用版本更新相关功能
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * 跳过的版本信息
 */
export interface SkippedVersionInfo {
  version: string;
  skipped_at: string;
}

/**
 * 更新器配置信息
 */
export interface UpdaterConfigInfo {
  proxy: string | null;
  auto_check_enabled: boolean;
  check_interval_hours: number;
  last_check_at: string | null;
}

/**
 * macOS 更新安装结果
 */
export interface MacOSUpdateInstallResult {
  success: boolean;
  error: string | null;
  update_version: string | null;
  installed_version: string | null;
}

/**
 * 应用更新 API
 */
export const appUpdaterApi = {
  /**
   * 获取所有跳过的版本
   */
  async getSkippedVersions(): Promise<SkippedVersionInfo[]> {
    return await invoke("get_skipped_versions");
  },

  /**
   * 跳过指定版本
   * @param version 要跳过的版本号
   */
  async skipVersion(version: string): Promise<boolean> {
    return await invoke("skip_app_version", { version });
  },

  /**
   * 检查版本是否被跳过
   * @param version 要检查的版本号
   */
  async isVersionSkipped(version: string): Promise<boolean> {
    return await invoke("is_version_skipped", { version });
  },

  /**
   * 移除跳过的版本（用于手动检查更新时）
   * @param version 要移除的版本号
   */
  async removeSkippedVersion(version: string): Promise<boolean> {
    return await invoke("remove_skipped_version", { version });
  },

  /**
   * 清除所有跳过的版本
   */
  async clearSkippedVersions(): Promise<boolean> {
    return await invoke("clear_skipped_versions");
  },

  /**
   * 获取更新器配置
   */
  async getConfig(): Promise<UpdaterConfigInfo> {
    return await invoke("get_updater_config");
  },

  /**
   * 设置更新代理
   * @param proxy 代理地址，null 表示清除代理
   */
  async setProxy(proxy: string | null): Promise<boolean> {
    return await invoke("set_updater_proxy", { proxy });
  },

  /**
   * 更新上次检测时间
   */
  async updateLastCheckTime(): Promise<boolean> {
    return await invoke("update_last_check_time");
  },

  /**
   * 检查是否需要自动检测更新
   */
  async shouldAutoCheck(): Promise<boolean> {
    return await invoke("should_auto_check_update");
  },

  /**
   * 保存更新器配置
   */
  async saveConfig(config: {
    proxy: string | null;
    autoCheckEnabled: boolean;
    checkIntervalHours: number;
  }): Promise<boolean> {
    return await invoke("save_updater_config", {
      proxy: config.proxy,
      autoCheckEnabled: config.autoCheckEnabled,
      checkIntervalHours: config.checkIntervalHours,
    });
  },

  // ==================== macOS 更新安装 API ====================

  /**
   * 尝试安装 macOS 上待处理的更新
   *
   * 当 Tauri 的 downloadAndInstall() 无法自动移动更新包到 /Applications 时，
   * 调用此方法尝试手动完成安装。
   */
  async tryInstallMacOSUpdate(): Promise<MacOSUpdateInstallResult> {
    return await invoke("try_install_macos_update");
  },

  /**
   * 检查是否有待安装的 macOS 更新
   * @returns 待安装的更新版本号，如果没有则返回 null
   */
  async checkPendingMacOSUpdate(): Promise<string | null> {
    return await invoke("check_pending_macos_update");
  },

  /**
   * 清理 macOS 临时更新包
   */
  async cleanupMacOSUpdate(): Promise<boolean> {
    return await invoke("cleanup_macos_update");
  },
};
