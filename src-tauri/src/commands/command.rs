//! Commands 命令层
//!
//! v3.11.0+ 统一管理架构：
//! - 支持三应用开关（Claude/Codex/Gemini）
//! - SSOT 存储在 ~/.cc-switch/commands/
//! - 支持命名空间组织

use crate::app_config::{
    AppType, CommandNamespace, CommandRepo, DiscoverableCommand, InstalledCommand,
    UnmanagedCommand,
};
use crate::services::command::{ChangeEvent, CommandService, ConflictResolution};
use crate::store::AppState;
use std::sync::Arc;
use tauri::State;

/// CommandService 状态包装
pub struct CommandServiceState(pub Arc<CommandService>);

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

/// 获取所有已安装的 Commands
#[tauri::command]
pub fn get_installed_commands(
    app_state: State<'_, AppState>,
) -> Result<Vec<InstalledCommand>, String> {
    CommandService::get_all_installed(&app_state.db).map_err(|e| e.to_string())
}

/// 获取所有命名空间
#[tauri::command]
pub fn get_command_namespaces(
    app_state: State<'_, AppState>,
) -> Result<Vec<CommandNamespace>, String> {
    CommandService::get_namespaces(&app_state.db).map_err(|e| e.to_string())
}

/// 安装 Command（统一安装）
///
/// 参数：
/// - command: 从发现列表获取的命令信息
/// - current_app: 当前选中的应用，安装后默认启用该应用
#[tauri::command]
pub async fn install_command_unified(
    command: DiscoverableCommand,
    current_app: String,
    service: State<'_, CommandServiceState>,
    app_state: State<'_, AppState>,
) -> Result<InstalledCommand, String> {
    let app_type = parse_app_type(&current_app)?;

    service
        .0
        .install(&app_state.db, &command, &app_type)
        .await
        .map_err(|e| e.to_string())
}

/// 卸载 Command（统一卸载）
#[tauri::command]
pub fn uninstall_command_unified(
    id: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    CommandService::uninstall(&app_state.db, &id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 切换 Command 的应用启用状态
#[tauri::command]
pub fn toggle_command_app(
    id: String,
    app: String,
    enabled: bool,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    CommandService::toggle_app(&app_state.db, &id, &app_type, enabled).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 创建命名空间
#[tauri::command]
pub fn create_command_namespace(namespace: String) -> Result<bool, String> {
    CommandService::create_namespace(&namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除命名空间
#[tauri::command]
pub fn delete_command_namespace(
    namespace: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    CommandService::delete_namespace(&app_state.db, &namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 扫描未管理的 Commands
#[tauri::command]
pub fn scan_unmanaged_commands(
    app_state: State<'_, AppState>,
) -> Result<Vec<UnmanagedCommand>, String> {
    CommandService::scan_unmanaged(&app_state.db).map_err(|e| e.to_string())
}

/// 从应用目录导入 Commands
#[tauri::command]
pub fn import_commands_from_apps(
    command_ids: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<InstalledCommand>, String> {
    CommandService::import_from_apps(&app_state.db, command_ids).map_err(|e| e.to_string())
}

// ========== 发现功能命令 ==========

/// 发现可安装的 Commands（从仓库获取）
#[tauri::command]
pub async fn discover_available_commands(
    service: State<'_, CommandServiceState>,
    app_state: State<'_, AppState>,
) -> Result<Vec<DiscoverableCommand>, String> {
    let repos = CommandService::get_repos(&app_state.db).map_err(|e| e.to_string())?;
    service
        .0
        .discover_available(repos)
        .await
        .map_err(|e| e.to_string())
}

// ========== 文件操作命令 ==========

/// 获取 Command 文件内容
#[tauri::command]
pub fn get_command_content(id: String) -> Result<String, String> {
    CommandService::get_command_content(&id).map_err(|e| e.to_string())
}

/// 在外部编辑器中打开 Command
#[tauri::command]
pub fn open_command_in_editor(id: String) -> Result<bool, String> {
    CommandService::open_in_editor(&id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 检查应用是否支持 Commands 功能
#[tauri::command]
pub fn check_app_commands_support(app: String) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    Ok(crate::services::command::check_app_commands_support(&app_type))
}

// ========== 仓库管理命令 ==========

/// 获取 Command 仓库列表
#[tauri::command]
pub fn get_command_repos(app_state: State<'_, AppState>) -> Result<Vec<CommandRepo>, String> {
    CommandService::get_repos(&app_state.db).map_err(|e| e.to_string())
}

/// 添加 Command 仓库
#[tauri::command]
pub fn add_command_repo(
    repo: CommandRepo,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    CommandService::add_repo(&app_state.db, &repo).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除 Command 仓库
#[tauri::command]
pub fn remove_command_repo(
    owner: String,
    name: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    CommandService::remove_repo(&app_state.db, &owner, &name).map_err(|e| e.to_string())?;
    Ok(true)
}

// ========== 变更检测命令 ==========

/// 检测 Commands 变更
///
/// 扫描 SSOT 目录和应用目录，检测文件变更、新增、删除和冲突
#[tauri::command]
pub fn detect_command_changes(app_state: State<'_, AppState>) -> Result<Vec<ChangeEvent>, String> {
    CommandService::detect_changes(&app_state.db).map_err(|e| e.to_string())
}

/// 解决 Command 冲突
///
/// 当应用目录与 SSOT 不一致时，选择保留哪个版本
#[tauri::command]
pub fn resolve_command_conflict(
    id: String,
    app: String,
    resolution: ConflictResolution,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    CommandService::resolve_conflict(&app_state.db, &id, &app_type, resolution)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 从 SSOT 刷新 Commands 到数据库
///
/// 重新解析所有 Command 文件，更新数据库中的元数据
#[tauri::command]
pub fn refresh_commands_from_ssot(app_state: State<'_, AppState>) -> Result<usize, String> {
    CommandService::refresh_from_ssot(&app_state.db).map_err(|e| e.to_string())
}

/// 同步所有 Commands 到应用目录
///
/// 确保所有已启用的应用目录与 SSOT 保持一致
#[tauri::command]
pub fn sync_commands_to_apps(app_state: State<'_, AppState>) -> Result<usize, String> {
    CommandService::sync_all_to_apps(&app_state.db).map_err(|e| e.to_string())
}
