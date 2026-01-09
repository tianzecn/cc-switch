//! 应用程序自动升级命令
//!
//! 提供应用程序版本更新相关的 Tauri 命令

#![allow(non_snake_case)]

use crate::services::app_updater::AppUpdaterService;
use crate::store::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 跳过版本信息（前端返回格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkippedVersionInfo {
    pub version: String,
    pub skipped_at: String,
}

/// 更新器配置（前端返回格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterConfigInfo {
    pub proxy: Option<String>,
    pub auto_check_enabled: bool,
    pub check_interval_hours: u32,
    pub last_check_at: Option<String>,
}

/// 获取所有跳过的版本
#[tauri::command]
pub async fn get_skipped_versions(state: State<'_, AppState>) -> Result<Vec<SkippedVersionInfo>, String> {
    let service = AppUpdaterService::new(state.db.clone());

    let versions = service
        .get_skipped_versions()
        .await
        .map_err(|e| e.to_string())?;

    Ok(versions
        .into_iter()
        .map(|v| SkippedVersionInfo {
            version: v.version,
            skipped_at: v.skipped_at.to_rfc3339(),
        })
        .collect())
}

/// 跳过指定版本
#[tauri::command]
pub async fn skip_app_version(state: State<'_, AppState>, version: String) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .skip_version(&version)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 检查版本是否被跳过
#[tauri::command]
pub async fn is_version_skipped(state: State<'_, AppState>, version: String) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .is_version_skipped(&version)
        .await
        .map_err(|e| e.to_string())
}

/// 移除跳过的版本（当用户手动检查更新时调用）
#[tauri::command]
pub async fn remove_skipped_version(state: State<'_, AppState>, version: String) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .remove_skipped_version(&version)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 清除所有跳过的版本
#[tauri::command]
pub async fn clear_skipped_versions(state: State<'_, AppState>) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .clear_skipped_versions()
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 获取更新器配置
#[tauri::command]
pub async fn get_updater_config(state: State<'_, AppState>) -> Result<UpdaterConfigInfo, String> {
    let service = AppUpdaterService::new(state.db.clone());

    let config = service
        .get_config()
        .await
        .map_err(|e| e.to_string())?;

    Ok(UpdaterConfigInfo {
        proxy: config.proxy,
        auto_check_enabled: config.auto_check_enabled,
        check_interval_hours: config.check_interval_hours,
        last_check_at: config.last_check_at.map(|dt| dt.to_rfc3339()),
    })
}

/// 设置更新代理
#[tauri::command]
pub async fn set_updater_proxy(state: State<'_, AppState>, proxy: Option<String>) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .set_proxy(proxy)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 更新上次检测时间
#[tauri::command]
pub async fn update_last_check_time(state: State<'_, AppState>) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .update_last_check_time()
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// 检查是否需要自动检测更新
#[tauri::command]
pub async fn should_auto_check_update(state: State<'_, AppState>) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    service
        .should_auto_check()
        .await
        .map_err(|e| e.to_string())
}

/// 保存更新器配置
#[tauri::command]
pub async fn save_updater_config(
    state: State<'_, AppState>,
    proxy: Option<String>,
    auto_check_enabled: bool,
    check_interval_hours: u32,
) -> Result<bool, String> {
    let service = AppUpdaterService::new(state.db.clone());

    let mut config = service
        .get_config()
        .await
        .map_err(|e| e.to_string())?;

    config.proxy = proxy;
    config.auto_check_enabled = auto_check_enabled;
    config.check_interval_hours = check_interval_hours;

    service
        .save_config(&config)
        .await
        .map_err(|e| e.to_string())?;

    Ok(true)
}

/// macOS 更新安装结果（前端返回格式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacOSUpdateInstallResultInfo {
    pub success: bool,
    pub error: Option<String>,
    pub update_version: Option<String>,
    pub installed_version: Option<String>,
}

/// 尝试安装 macOS 上待处理的更新
///
/// 当 Tauri 的 downloadAndInstall() 无法自动移动更新包到 /Applications 时，
/// 调用此命令尝试手动完成安装。
#[tauri::command]
pub async fn try_install_macos_update() -> Result<MacOSUpdateInstallResultInfo, String> {
    let result = crate::services::app_updater::try_install_macos_update().await;

    Ok(MacOSUpdateInstallResultInfo {
        success: result.success,
        error: result.error,
        update_version: result.update_version,
        installed_version: result.installed_version,
    })
}

/// 检查是否有待安装的 macOS 更新
#[tauri::command]
pub async fn check_pending_macos_update() -> Result<Option<String>, String> {
    Ok(crate::services::app_updater::check_pending_macos_update().await)
}

/// 清理 macOS 临时更新包
#[tauri::command]
pub async fn cleanup_macos_update() -> Result<bool, String> {
    crate::services::app_updater::cleanup_macos_update()
        .await
        .map_err(|e| e.to_string())?;
    Ok(true)
}
