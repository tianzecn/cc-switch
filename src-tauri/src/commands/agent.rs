//! Agents 命令层
//!
//! v3.11.0+ 统一管理架构：
//! - 支持三应用开关（Claude/Codex/Gemini）
//! - SSOT 存储在 ~/.cc-switch/agents/
//! - 支持命名空间组织

use crate::app_config::{
    AgentNamespace, AppType, CommandRepo, DiscoverableAgent, InstallScope, InstalledAgent,
    UnmanagedAgent,
};
use crate::services::agent::{AgentService, ChangeEvent, ConflictResolution, check_app_agents_support};
use crate::store::AppState;
use std::sync::Arc;
use tauri::State;

/// AgentService 状态包装
pub struct AgentServiceState(pub Arc<AgentService>);

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

/// 获取所有已安装的 Agents
#[tauri::command]
pub fn get_installed_agents(app_state: State<'_, AppState>) -> Result<Vec<InstalledAgent>, String> {
    AgentService::get_all_installed(&app_state.db).map_err(|e| e.to_string())
}

/// 获取所有命名空间
#[tauri::command]
pub fn get_agent_namespaces(
    app_state: State<'_, AppState>,
) -> Result<Vec<AgentNamespace>, String> {
    AgentService::get_namespaces(&app_state.db).map_err(|e| e.to_string())
}

/// 安装 Agent（统一安装）
///
/// 参数：
/// - agent: 从发现列表获取的 agent 信息
/// - current_app: 当前选中的应用，安装后默认启用该应用
#[tauri::command]
pub async fn install_agent_unified(
    agent: DiscoverableAgent,
    current_app: String,
    scope: Option<String>,
    project_path: Option<String>,
    service: State<'_, AgentServiceState>,
    app_state: State<'_, AppState>,
) -> Result<InstalledAgent, String> {
    let app_type = parse_app_type(&current_app)?;

    // 先执行全局安装
    let installed = service
        .0
        .install(&app_state.db, &agent, &app_type)
        .await
        .map_err(|e| e.to_string())?;

    // 如果指定了项目范围，则切换到项目范围
    if let Some(scope_str) = scope {
        if scope_str == "project" {
            let install_scope = InstallScope::from_db(&scope_str, project_path.as_deref());
            AgentService::change_scope(&app_state.db, &installed.id, &install_scope, &app_type)
                .map_err(|e| e.to_string())?;

            // 重新获取更新后的记录
            return app_state
                .db
                .get_installed_agent(&installed.id)
                .map_err(|e| e.to_string())?
                .ok_or_else(|| "Agent not found after scope change".to_string());
        }
    }

    Ok(installed)
}

/// 卸载 Agent（统一卸载）
#[tauri::command]
pub fn uninstall_agent_unified(id: String, app_state: State<'_, AppState>) -> Result<bool, String> {
    AgentService::uninstall(&app_state.db, &id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 批量卸载 Agents
///
/// 返回成功卸载的数量
#[tauri::command]
pub fn uninstall_agents_batch(
    ids: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut success_count = 0;
    for id in &ids {
        match AgentService::uninstall(&app_state.db, id) {
            Ok(_) => success_count += 1,
            Err(e) => log::warn!("卸载 Agent {} 失败: {}", id, e),
        }
    }
    Ok(success_count)
}

/// 切换 Agent 的应用启用状态
#[tauri::command]
pub fn toggle_agent_app(
    id: String,
    app: String,
    enabled: bool,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    AgentService::toggle_app(&app_state.db, &id, &app_type, enabled).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 修改 Agent 的安装范围
///
/// 参数：
/// - id: Agent ID
/// - scope: 新的范围（"global" 或 "project"）
/// - project_path: 项目路径（当 scope="project" 时必填）
/// - current_app: 当前应用类型
#[tauri::command]
pub fn change_agent_scope(
    id: String,
    scope: String,
    project_path: Option<String>,
    current_app: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&current_app)?;
    let new_scope = InstallScope::from_db(&scope, project_path.as_deref());
    AgentService::change_scope(&app_state.db, &id, &new_scope, &app_type)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 创建命名空间
#[tauri::command]
pub fn create_agent_namespace(namespace: String) -> Result<bool, String> {
    AgentService::create_namespace(&namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除命名空间
#[tauri::command]
pub fn delete_agent_namespace(
    namespace: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    AgentService::delete_namespace(&app_state.db, &namespace).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 扫描未管理的 Agents
#[tauri::command]
pub fn scan_unmanaged_agents(
    app_state: State<'_, AppState>,
) -> Result<Vec<UnmanagedAgent>, String> {
    AgentService::scan_unmanaged(&app_state.db).map_err(|e| e.to_string())
}

/// 从应用目录导入 Agents
#[tauri::command]
pub fn import_agents_from_apps(
    agent_ids: Vec<String>,
    app_state: State<'_, AppState>,
) -> Result<Vec<InstalledAgent>, String> {
    AgentService::import_from_apps(&app_state.db, agent_ids).map_err(|e| e.to_string())
}

// ========== 发现功能命令 ==========

/// 发现可安装的 Agents（从仓库获取，带缓存支持）
///
/// # 参数
/// - `force_refresh`: 是否强制刷新（跳过缓存，默认 false）
#[tauri::command]
pub async fn discover_available_agents(
    service: State<'_, AgentServiceState>,
    app_state: State<'_, AppState>,
    force_refresh: Option<bool>,
) -> Result<Vec<DiscoverableAgent>, String> {
    let repos = AgentService::get_repos(&app_state.db).map_err(|e| e.to_string())?;
    service
        .0
        .discover_available(&app_state.db, repos, force_refresh.unwrap_or(false))
        .await
        .map_err(|e| e.to_string())
}

// ========== 文件操作命令 ==========

/// 获取 Agent 文件内容
#[tauri::command]
pub fn get_agent_content(id: String) -> Result<String, String> {
    AgentService::get_agent_content(&id).map_err(|e| e.to_string())
}

/// 在外部编辑器中打开 Agent
#[tauri::command]
pub fn open_agent_in_editor(id: String) -> Result<bool, String> {
    AgentService::open_in_editor(&id).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 检查应用是否支持 Agents 功能
#[tauri::command]
pub fn check_app_agents_support_cmd(app: String) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    Ok(check_app_agents_support(&app_type))
}

// ========== 仓库管理命令 ==========

/// 获取 Agent 仓库列表（共用 command_repos 表）
#[tauri::command]
pub fn get_agent_repos(app_state: State<'_, AppState>) -> Result<Vec<CommandRepo>, String> {
    AgentService::get_repos(&app_state.db).map_err(|e| e.to_string())
}

/// 添加 Agent 仓库（共用 command_repos 表）
#[tauri::command]
pub fn add_agent_repo(repo: CommandRepo, app_state: State<'_, AppState>) -> Result<bool, String> {
    AgentService::add_repo(&app_state.db, &repo).map_err(|e| e.to_string())?;
    Ok(true)
}

/// 删除 Agent 仓库
#[tauri::command]
pub fn remove_agent_repo(
    owner: String,
    name: String,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    AgentService::remove_repo(&app_state.db, &owner, &name).map_err(|e| e.to_string())?;
    // 同时删除该仓库的缓存
    let _ = app_state.db.delete_agent_repo_cache(&owner, &name);
    Ok(true)
}

/// 清除 Agents 发现缓存
///
/// # 参数
/// - `owner`: 可选，仓库所有者。如果提供则只清除该仓库的缓存
/// - `name`: 可选，仓库名称。与 owner 一起使用
#[tauri::command]
pub fn clear_agent_cache(
    owner: Option<String>,
    name: Option<String>,
    app_state: State<'_, AppState>,
) -> Result<usize, String> {
    match (owner, name) {
        (Some(o), Some(n)) => app_state
            .db
            .delete_agent_repo_cache(&o, &n)
            .map_err(|e| e.to_string()),
        _ => app_state
            .db
            .clear_all_agent_cache()
            .map_err(|e| e.to_string()),
    }
}

// ========== 变更检测命令 ==========

/// 检测 Agents 变更
///
/// 扫描 SSOT 目录和应用目录，检测文件变更、新增、删除和冲突
#[tauri::command]
pub fn detect_agent_changes(app_state: State<'_, AppState>) -> Result<Vec<ChangeEvent>, String> {
    AgentService::detect_changes(&app_state.db).map_err(|e| e.to_string())
}

/// 解决 Agent 冲突
///
/// 当应用目录与 SSOT 不一致时，选择保留哪个版本
#[tauri::command]
pub fn resolve_agent_conflict(
    id: String,
    app: String,
    resolution: ConflictResolution,
    app_state: State<'_, AppState>,
) -> Result<bool, String> {
    let app_type = parse_app_type(&app)?;
    AgentService::resolve_conflict(&app_state.db, &id, &app_type, resolution)
        .map_err(|e| e.to_string())?;
    Ok(true)
}

/// 从 SSOT 刷新 Agents 到数据库
///
/// 重新解析所有 Agent 文件，更新数据库中的元数据
#[tauri::command]
pub fn refresh_agents_from_ssot(app_state: State<'_, AppState>) -> Result<usize, String> {
    AgentService::refresh_from_ssot(&app_state.db).map_err(|e| e.to_string())
}

/// 同步所有 Agents 到应用目录
///
/// 确保所有已启用的应用目录与 SSOT 保持一致
#[tauri::command]
pub fn sync_agents_to_apps(app_state: State<'_, AppState>) -> Result<usize, String> {
    AgentService::sync_all_to_apps(&app_state.db).map_err(|e| e.to_string())
}
