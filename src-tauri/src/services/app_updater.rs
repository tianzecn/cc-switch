//! 应用程序自动升级服务
//!
//! 负责管理应用程序的版本更新功能，包括：
//! - 跳过版本记录
//! - 代理配置
//! - 更新检测设置

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::database::{lock_conn, Database};
use crate::error::AppError;

/// 跳过的版本记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkippedVersion {
    /// 版本号
    pub version: String,
    /// 跳过时间
    pub skipped_at: DateTime<Utc>,
}

/// 更新器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfig {
    /// 自定义代理 URL（可选）
    pub proxy: Option<String>,
    /// 是否启用自动检测
    pub auto_check_enabled: bool,
    /// 检测间隔（小时）
    pub check_interval_hours: u32,
    /// 上次检测时间
    pub last_check_at: Option<DateTime<Utc>>,
}

impl Default for UpdaterConfig {
    fn default() -> Self {
        Self {
            proxy: None,
            auto_check_enabled: true,
            check_interval_hours: 6,
            last_check_at: None,
        }
    }
}

/// 更新信息（来自 latest.json）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    /// 新版本号
    pub version: String,
    /// 更新日志
    pub notes: String,
    /// 发布日期
    pub pub_date: String,
    /// 是否为强制更新
    pub mandatory: bool,
}

/// 应用更新服务
pub struct AppUpdaterService {
    db: Arc<Database>,
}

impl AppUpdaterService {
    pub fn new(db: Arc<Database>) -> Self {
        Self { db }
    }

    /// 获取所有跳过的版本
    pub async fn get_skipped_versions(&self) -> Result<Vec<SkippedVersion>, AppError> {
        let conn = lock_conn!(self.db.conn);

        let mut stmt = conn.prepare(
            "SELECT version, skipped_at FROM skipped_versions ORDER BY skipped_at DESC",
        )?;

        let versions = stmt
            .query_map([], |row| {
                let version: String = row.get(0)?;
                let skipped_at: String = row.get(1)?;
                Ok((version, skipped_at))
            })?
            .filter_map(|r| r.ok())
            .filter_map(|(version, skipped_at)| {
                DateTime::parse_from_rfc3339(&skipped_at)
                    .ok()
                    .map(|dt| SkippedVersion {
                        version,
                        skipped_at: dt.with_timezone(&Utc),
                    })
            })
            .collect();

        Ok(versions)
    }

    /// 添加跳过的版本
    pub async fn skip_version(&self, version: &str) -> Result<(), AppError> {
        let conn = lock_conn!(self.db.conn);

        let now = Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO skipped_versions (version, skipped_at) VALUES (?1, ?2)",
            rusqlite::params![version, now],
        )?;

        log::info!("Skipped version: {}", version);
        Ok(())
    }

    /// 移除跳过的版本（当新版本发布时，旧的跳过记录可能需要清理）
    pub async fn remove_skipped_version(&self, version: &str) -> Result<(), AppError> {
        let conn = lock_conn!(self.db.conn);

        conn.execute(
            "DELETE FROM skipped_versions WHERE version = ?1",
            rusqlite::params![version],
        )?;

        Ok(())
    }

    /// 检查版本是否被跳过
    pub async fn is_version_skipped(&self, version: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.db.conn);

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM skipped_versions WHERE version = ?1",
            rusqlite::params![version],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// 清理所有跳过的版本（当用户手动检查更新时可能需要）
    pub async fn clear_skipped_versions(&self) -> Result<(), AppError> {
        let conn = lock_conn!(self.db.conn);

        conn.execute("DELETE FROM skipped_versions", [])?;
        log::info!("Cleared all skipped versions");
        Ok(())
    }

    /// 获取更新器配置
    pub async fn get_config(&self) -> Result<UpdaterConfig, AppError> {
        let conn = lock_conn!(self.db.conn);

        let config_json: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'updater_config'",
                [],
                |row| row.get(0),
            )
            .ok();

        match config_json {
            Some(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
            None => Ok(UpdaterConfig::default()),
        }
    }

    /// 保存更新器配置
    pub async fn save_config(&self, config: &UpdaterConfig) -> Result<(), AppError> {
        let conn = lock_conn!(self.db.conn);

        let json = serde_json::to_string(config).map_err(|e| AppError::JsonSerialize { source: e })?;
        conn.execute(
            "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('updater_config', ?1)",
            rusqlite::params![json],
        )?;

        log::info!("Updater config saved");
        Ok(())
    }

    /// 设置代理
    pub async fn set_proxy(&self, proxy: Option<String>) -> Result<(), AppError> {
        let mut config = self.get_config().await?;
        config.proxy = proxy;
        self.save_config(&config).await
    }

    /// 更新上次检测时间
    pub async fn update_last_check_time(&self) -> Result<(), AppError> {
        let mut config = self.get_config().await?;
        config.last_check_at = Some(Utc::now());
        self.save_config(&config).await
    }

    /// 检查是否需要自动检测更新（基于配置的间隔）
    pub async fn should_auto_check(&self) -> Result<bool, AppError> {
        let config = self.get_config().await?;

        if !config.auto_check_enabled {
            return Ok(false);
        }

        match config.last_check_at {
            None => Ok(true), // 从未检测过，应该检测
            Some(last_check) => {
                let now = Utc::now();
                let elapsed = now.signed_duration_since(last_check);
                let interval_hours = config.check_interval_hours as i64;
                Ok(elapsed.num_hours() >= interval_hours)
            }
        }
    }
}

/// macOS 更新安装结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacOSUpdateInstallResult {
    /// 是否安装成功
    pub success: bool,
    /// 错误信息（如果失败）
    pub error: Option<String>,
    /// 更新包版本
    pub update_version: Option<String>,
    /// 安装后的应用版本
    pub installed_version: Option<String>,
}

/// 尝试在 macOS 上手动安装更新包
///
/// 当 Tauri 的 downloadAndInstall() 无法自动移动更新包到 /Applications 时，
/// 调用此函数尝试手动完成安装。
#[cfg(target_os = "macos")]
pub async fn try_install_macos_update() -> MacOSUpdateInstallResult {
    use std::fs;
    use std::path::Path;
    use std::process::Command;

    let temp_app_path = "/tmp/CC Switch.app";
    let app_path = "/Applications/CC Switch.app";

    // 检查临时更新包是否存在
    if !Path::new(temp_app_path).exists() {
        return MacOSUpdateInstallResult {
            success: false,
            error: Some("没有找到待安装的更新包".to_string()),
            update_version: None,
            installed_version: None,
        };
    }

    // 读取更新包的版本号
    let update_version = read_app_version(temp_app_path);
    log::info!("[macOS Updater] Found update package: {:?}", update_version);

    // 读取当前安装的版本号
    let current_version = read_app_version(app_path);
    log::info!("[macOS Updater] Current installed version: {:?}", current_version);

    // 尝试使用 rsync 复制更新包（比 mv 更可靠）
    log::info!("[macOS Updater] Attempting to install update...");
    let result = Command::new("rsync")
        .args(["-av", "--delete", &format!("{}/", temp_app_path), &format!("{}/", app_path)])
        .output();

    match result {
        Ok(output) => {
            if output.status.success() {
                // 安装成功，删除临时更新包
                let _ = fs::remove_dir_all(temp_app_path);

                // 验证安装后的版本
                let installed_version = read_app_version(app_path);
                log::info!("[macOS Updater] Installation successful! Version: {:?}", installed_version);

                MacOSUpdateInstallResult {
                    success: true,
                    error: None,
                    update_version,
                    installed_version,
                }
            } else {
                let stderr = String::from_utf8_lossy(&output.stderr);
                log::error!("[macOS Updater] rsync failed: {}", stderr);

                MacOSUpdateInstallResult {
                    success: false,
                    error: Some(format!("安装失败: {}", stderr)),
                    update_version,
                    installed_version: current_version,
                }
            }
        }
        Err(e) => {
            log::error!("[macOS Updater] Failed to execute rsync: {}", e);

            MacOSUpdateInstallResult {
                success: false,
                error: Some(format!("执行安装命令失败: {}", e)),
                update_version,
                installed_version: current_version,
            }
        }
    }
}

/// 读取 .app 包的版本号
#[cfg(target_os = "macos")]
fn read_app_version(app_path: &str) -> Option<String> {
    use std::path::Path;
    use std::process::Command;

    let plist_path = format!("{}/Contents/Info.plist", app_path);
    if !Path::new(&plist_path).exists() {
        return None;
    }

    // 使用 defaults 命令读取 plist
    let output = Command::new("defaults")
        .args(["read", &plist_path, "CFBundleShortVersionString"])
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// 检查是否有待安装的 macOS 更新
#[cfg(target_os = "macos")]
pub async fn check_pending_macos_update() -> Option<String> {
    use std::path::Path;

    let temp_app_path = "/tmp/CC Switch.app";
    if Path::new(temp_app_path).exists() {
        read_app_version(temp_app_path)
    } else {
        None
    }
}

/// 清理 macOS 临时更新包
#[cfg(target_os = "macos")]
pub async fn cleanup_macos_update() -> Result<(), AppError> {
    use std::fs;
    use std::path::Path;

    let temp_app_path = "/tmp/CC Switch.app";
    if Path::new(temp_app_path).exists() {
        fs::remove_dir_all(temp_app_path).map_err(|e| {
            AppError::Message(format!("清理临时更新包失败: {}", e))
        })?;
        log::info!("[macOS Updater] Cleaned up temporary update package");
    }
    Ok(())
}

// 非 macOS 平台的空实现
#[cfg(not(target_os = "macos"))]
pub async fn try_install_macos_update() -> MacOSUpdateInstallResult {
    MacOSUpdateInstallResult {
        success: false,
        error: Some("此功能仅支持 macOS".to_string()),
        update_version: None,
        installed_version: None,
    }
}

#[cfg(not(target_os = "macos"))]
pub async fn check_pending_macos_update() -> Option<String> {
    None
}

#[cfg(not(target_os = "macos"))]
pub async fn cleanup_macos_update() -> Result<(), AppError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_updater_config_default() {
        let config = UpdaterConfig::default();
        assert!(config.auto_check_enabled);
        assert_eq!(config.check_interval_hours, 6);
        assert!(config.proxy.is_none());
        assert!(config.last_check_at.is_none());
    }
}
