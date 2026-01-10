//! Hooks 命令层
//!
//! 统一管理架构：
//! - 支持三应用开关（Claude/Codex/Gemini）
//! - SSOT 存储在 ~/.cc-switch/hooks/
//! - 支持命名空间组织
//! - 同步到 settings.json 的 hooks 字段

use crate::app_config::{
    AppType, CommandRepo, DiscoverableHook, HookNamespace, InstallScope, InstalledHook,
    UnmanagedHook,
};
use crate::services::hook::{check_app_hooks_support, HookService};
use crate::store::AppState;
use std::sync::Arc;
use tauri::State;

/// HookService 状态包装
pub struct HookServiceState(pub Arc<HookService>);

/// 解析 app 参数为 AppType
fn parse_app_type(app: &str) -> Result<AppType, String> {
    match app.to_lowercase().as_str() {
        "claude" => Ok(AppType::Claude),
        "codex" => Ok(AppType::Codex),
        "gemini" => Ok(AppType::Gemini),
        _ => Err(format!("不支持的 app 类型: {app}")),
    }
}

// ========== 统一管理命令 ==========

/// 获取所有已安装的 Hooks
#[tauri::command]
pub fn get_installed_hooks(app_state: State<'_, AppState>) -> Result<Vec<InstalledHook>, String> {
    HookService::get_all_installed(&app_state.db).map_err(|e| e.to_string())
}

/// 获取所有命名空间
#[tauri::command]
pub fn get_hook_namespaces(app_state: State<'_, AppState>) -> Result<Vec<HookNamespace>, String> {
    HookService::get_namespaces(&app_state.db).map_err(|e| e.to_string())
}

/// 安装 Hook（统一安装）
///
/// 参数：
/// - hook: 从发现列表获取的 hook 信息
/// - current_app: 当前选中的应用，安装后默认启用该应用
#[tauri::command]
pub async fn install_hook_unified(
    hook: DiscoverableHook,
    current_app: String,
    scope: Option<String>,
    project_path: Option<String>,
    service: State<'_, HookServiceState>,
    app_state: State<'_, AppState>,
) -> Result<InstalledHook, String> {
    let app_type = parse_app_type(&current_app)?;

    // 先执行全局安装
    let installed = service
        .0
        .install(&app_state.db, &hook, &app_type)
        .await
        .map_err(|e| e.to_string())?;

    // 如果指定了项目范围，则切换到项目范围
    if let Some(scope_str) = scope {
        if scope_str == "project" {
            let install_scope = InstallScope::from_db(&scope_str, project_path.as_deref());
            HookService::change_scope(&app_state.db, &installed.id, &install_scope, &app_type)
                .map_err(|e| e.to_string())?;

            // 重新获取更新后的记录
            return app_state
                .db
                .get_installed_hook(&installed.id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "Hook not found after scope change".to_string());
        }
    }

    Ok(installed)
}

/// 卸载 Hook（统一卸载）
#[tauri::command]
pub fn uninstall_hook_unified(id: String, app_state: State<'_, AppState>) -> Result<bool, String> {
    HookService::uninstall(&app_state.db, &id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 切换 Hook 的全局启用状态
#[tauri::command]
pub fn toggle_hook_enabled(
    id: String,
    enabled: bool,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    HookService::toggle_enabled(&app_state.db, &id, enabled).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 切换 Hook 的应用启用状态
#[tauri::command]
pub fn toggle_hook_app(
    id: String,
    app: String,
    enabled: bool,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    HookService::toggle_app(&app_state.db, &id, &app_type, enabled).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 修改 Hook 的安装范围
///
/// 参数：
/// - id: Hook ID
/// - scope: 新的范围（"global" 或 "project"）
/// - project_path: 项目路径（当 scope="project" 时必填）
/// - current_app: 当前应用类型
#[tauri::command]
pub fn change_hook_scope(
    id: String,
    scope: String,
    project_path: Option<String>,
    current_app: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&current_app)?;
    let new_scope = InstallScope::from_db(&scope, project_path.as_deref());
    HookService::change_scope(&app_state.db, &id, &new_scope, &app_type)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 更新 Hook 优先级
#[tauri::command]
pub fn update_hook_priority(
    id: String,
    priority: i32,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    HookService::update_priority(&app_state.db, &id, priority).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 批量更新 Hook 优先级（拖拽排序）
#[tauri::command]
pub fn reorder_hooks(ids: Vec<String>, app_state: State<'_, AppState>) -> Result<bool, String> {
    HookService::reorder_hooks(&app_state.db, ids).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 创建命名空间
#[tauri::command]
pub fn create_hook_namespace(namespace: String) -> Result<bool, String> {
    HookService::create_namespace(&namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除命名空间
#[tauri::command]
pub fn delete_hook_namespace(
    namespace: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    HookService::delete_namespace(&app_state.db, &namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 扫描未管理的 Hooks
#[tauri::command]
pub fn scan_unmanaged_hooks(app_state: State<'_, AppState>) -> Result<Vec<UnmanagedHook>, String> {
    HookService::scan_unmanaged(&app_state.db).map_err(|e| e.to_string())
}

// ========== 发现功能命令 ==========

/// 发现可安装的 Hooks（从仓库获取，带缓存支持）
///
/// # 参数
/// - `force_refresh`: 是否强制刷新（跳过缓存，默认 false）
#[tauri::command]
pub async fn discover_available_hooks(
    service: State<'_, HookServiceState>,
    app_state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<Vec<DiscoverableHook>, String> {
    let repos = HookService::get_repos(&app_state.db).map_err(|e| e.to_string())?;
    service
        .0
        .discover_available(&app_state.db, repos, force_refresh.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

// ========== 文件操作命令 ==========

/// 获取 Hook 文件内容
#[tauri::command]
pub fn get_hook_content(id: String) -> Result<String, String> {
    HookService::get_hook_content(&id).map_err(|e| e.to_string())
}

/// 在外部编辑器中打开 Hook
#[tauri::command]
pub fn open_hook_in_editor(id: String) -> Result<bool, String> {
    HookService::open_in_editor(&id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 检查应用是否支持 Hooks 功能
#[tauri::command]
pub fn check_app_hooks_support_cmd(app: String) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    Ok(check_app_hooks_support(&app_type))
}

// ========== 仓库管理命令 ==========

/// 获取 Hook 仓库列表（共用 command_repos 表）
#[tauri::command]
pub fn get_hook_repos(app_state: State<'_, AppState>) -> Result<Vec<CommandRepo>, String> {
    HookService::get_repos(&app_state.db).map_err(|e| e.to_string())
}

/// 添加 Hook 仓库（共用 command_repos 表）
#[tauri::command]
pub fn add_hook_repo(repo: CommandRepo, app_state: State<'_, AppState>) -> Result<bool, String> {
    HookService::add_repo(&app_state.db, &repo).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除 Hook 仓库
#[tauri::command]
pub fn remove_hook_repo(
    owner: String,
    name: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    HookService::remove_repo(&app_state.db, &owner, &name).map_err(|e| e.to_string())?;
    // 同时删除该仓库的缓存
    let _ = app_state.db.delete_hook_repo_cache(&owner, &name);
    Ok(true)
}

/// 清除 Hooks 发现缓存
///
/// # 参数
/// - `owner`: 可选，仓库所有者。如果提供则只清除该仓库的缓存
/// - `name`: 可选，仓库名称。与 owner 一起使用
#[tauri::command]
pub fn clear_hook_cache(
    owner: Option<String>,
    name: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<usize, String> {
    match (owner, name) {
        (Some(o), Some(n)) => app_state
            .db
            .delete_hook_repo_cache(&o, &n)
            .map_err(|e| e.to_string()),
        _ => app_state
            .db
            .clear_all_hook_cache()
            .map_err(|e| e.to_string()),
    }
}

// ========== 同步操作命令 ==========

/// 从 SSOT 刷新 Hooks 到数据库
///
/// 重新解析所有 Hook 文件，更新数据库中的元数据
#[tauri::command]
pub fn refresh_hooks_from_ssot(app_state: State<'_, AppState>) -> Result<usize, String> {
    HookService::refresh_from_ssot(&app_state.db).map_err(|e| e.to_string())
}

/// 同步所有 Hooks 到应用 settings.json
///
/// 将已启用的 Hooks 合并写入各应用的 settings.json hooks 字段
#[tauri::command]
pub fn sync_hooks_to_apps(app_state: State<'_, AppState>) -> Result<usize, String> {
    HookService::sync_all_to_apps(&app_state.db).map_err(|e| e.to_string())
}
