//! 资源更新检测和执行命令
//!
//! 提供 Skills/Commands/Hooks/Agents 的更新检测和执行功能的 Tauri 命令。

use crate::app_config::{AppType, DiscoverableCommand, DiscoverableAgent};
use crate::database::Database;
use crate::error::AppError;
use crate::services::agent::AgentService;
use crate::services::command::CommandService;
use crate::services::github_api::{GitHubApiService, RateLimitInfo, UpdateCheckResult};
use crate::services::skill::{DiscoverableSkill, SkillService};
use crate::services::update::{BatchCheckResult, BatchUpdateResult, ResourceType, UpdateExecuteResult, UpdateService};
use crate::store::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 单个资源更新结果（包含新 hash）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillUpdateResult {
    pub id: String,
    pub success: bool,
    pub new_hash: Option<String>,
    pub error: Option<String>,
}

/// 检查所有 Skills 的更新
#[tauri::command]
pub async fn check_skills_updates(
    app_state: State<'_, AppState>,
) -> Result<BatchCheckResult, AppError> {
    let db = &app_state.db;
    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);
    service.check_skills_updates(db).await
}

/// 检查单个 Skill 的更新
#[tauri::command]
pub async fn check_skill_update(
    app_state: State<'_, AppState>,
    skill_id: String,
) -> Result<UpdateCheckResult, AppError> {
    let db = &app_state.db;
    let skill = db
        .get_installed_skill(&skill_id)?
        .ok_or_else(|| AppError::Message(format!("Skill 不存在: {skill_id}")))?;

    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);
    Ok(service.check_skill_update(&skill).await)
}

/// 批量检查指定 Skills 的更新
///
/// 根据传入的 skill_ids 只检查对应的 Skills，用于按仓库/命名空间过滤检查
#[tauri::command]
pub async fn check_skills_updates_by_ids(
    app_state: State<'_, AppState>,
    skill_ids: Vec<String>,
) -> Result<BatchCheckResult, AppError> {
    let db = &app_state.db;
    let all_skills = db.get_all_installed_skills()?;

    // 过滤出指定的 Skills
    let skills_to_check: Vec<_> = skill_ids
        .iter()
        .filter_map(|id| all_skills.get(id).cloned())
        .collect();

    if skills_to_check.is_empty() {
        return Ok(BatchCheckResult {
            success_count: 0,
            failed_count: 0,
            update_count: 0,
            deleted_count: 0,
            results: vec![],
        });
    }

    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);
    service.check_skills_updates_batch(skills_to_check).await
}

/// 检查所有 Commands 的更新
#[tauri::command]
pub async fn check_commands_updates(
    app_state: State<'_, AppState>,
) -> Result<BatchCheckResult, AppError> {
    let db = &app_state.db;
    let commands = db.get_all_installed_commands()?;
    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);

    let mut results: Vec<UpdateCheckResult> = Vec::new();

    for command in commands.values() {
        // 使用数据库中保存的 source_path
        let result = service
            .check_file_resource_update(
                &command.id,
                command.repo_owner.as_deref(),
                command.repo_name.as_deref(),
                command.repo_branch.as_deref(),
                command.source_path.as_deref(),
                command.file_hash.as_deref(),
            )
            .await;
        results.push(result);
    }

    let success_count = results.iter().filter(|r| r.error.is_none()).count() as u32;
    let failed_count = results.iter().filter(|r| r.error.is_some()).count() as u32;
    let update_count = results.iter().filter(|r| r.has_update).count() as u32;
    let deleted_count = results.iter().filter(|r| r.remote_deleted).count() as u32;

    Ok(BatchCheckResult {
        success_count,
        failed_count,
        update_count,
        deleted_count,
        results,
    })
}

/// 检查所有 Hooks 的更新
#[tauri::command]
pub async fn check_hooks_updates(
    app_state: State<'_, AppState>,
) -> Result<BatchCheckResult, AppError> {
    let db = &app_state.db;
    let hooks = db.get_all_installed_hooks()?;
    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);

    let mut results: Vec<UpdateCheckResult> = Vec::new();

    for hook in hooks.values() {
        let result = service
            .check_file_resource_update(
                &hook.id,
                hook.repo_owner.as_deref(),
                hook.repo_name.as_deref(),
                hook.repo_branch.as_deref(),
                hook.source_path.as_deref(),
                hook.file_hash.as_deref(),
            )
            .await;
        results.push(result);
    }

    let success_count = results.iter().filter(|r| r.error.is_none()).count() as u32;
    let failed_count = results.iter().filter(|r| r.error.is_some()).count() as u32;
    let update_count = results.iter().filter(|r| r.has_update).count() as u32;
    let deleted_count = results.iter().filter(|r| r.remote_deleted).count() as u32;

    Ok(BatchCheckResult {
        success_count,
        failed_count,
        update_count,
        deleted_count,
        results,
    })
}

/// 检查所有 Agents 的更新
#[tauri::command]
pub async fn check_agents_updates(
    app_state: State<'_, AppState>,
) -> Result<BatchCheckResult, AppError> {
    let db = &app_state.db;
    let agents = db.get_all_installed_agents()?;
    let github_token = db.get_setting("github_pat")?;
    let service = UpdateService::new(github_token);

    let mut results: Vec<UpdateCheckResult> = Vec::new();

    for agent in agents.values() {
        let result = service
            .check_file_resource_update(
                &agent.id,
                agent.repo_owner.as_deref(),
                agent.repo_name.as_deref(),
                agent.repo_branch.as_deref(),
                agent.source_path.as_deref(),
                agent.file_hash.as_deref(),
            )
            .await;
        results.push(result);
    }

    let success_count = results.iter().filter(|r| r.error.is_none()).count() as u32;
    let failed_count = results.iter().filter(|r| r.error.is_some()).count() as u32;
    let update_count = results.iter().filter(|r| r.has_update).count() as u32;
    let deleted_count = results.iter().filter(|r| r.remote_deleted).count() as u32;

    Ok(BatchCheckResult {
        success_count,
        failed_count,
        update_count,
        deleted_count,
        results,
    })
}

/// 验证 GitHub Token
#[tauri::command]
pub async fn validate_github_token(token: String) -> Result<RateLimitInfo, AppError> {
    let service = GitHubApiService::with_token(token);
    service
        .validate_token()
        .await
        .map_err(|e| AppError::Message(e.to_string()))
}

/// 保存 GitHub Token
#[tauri::command]
pub async fn save_github_token(
    app_state: State<'_, AppState>,
    token: Option<String>,
) -> Result<(), AppError> {
    let db = &app_state.db;
    if let Some(t) = token {
        if t.is_empty() {
            db.delete_setting("github_pat")?;
        } else {
            db.set_setting("github_pat", &t)?;
        }
    } else {
        db.delete_setting("github_pat")?;
    }
    Ok(())
}

/// 获取当前 GitHub Token（脱敏）
#[tauri::command]
pub async fn get_github_token_status(
    app_state: State<'_, AppState>,
) -> Result<Option<String>, AppError> {
    let db = &app_state.db;
    match db.get_setting("github_pat")? {
        Some(token) if token.len() > 8 => {
            // 返回脱敏的 Token（只显示前4位和后4位）
            let masked = format!(
                "{}...{}",
                &token[..4],
                &token[token.len() - 4..]
            );
            Ok(Some(masked))
        }
        Some(_) => Ok(Some("****".to_string())),
        None => Ok(None),
    }
}

/// 获取指定资源类型的更新检测结果
#[tauri::command]
pub async fn check_resource_updates(
    app_state: State<'_, AppState>,
    resource_type: ResourceType,
) -> Result<BatchCheckResult, AppError> {
    match resource_type {
        ResourceType::Skill => check_skills_updates(app_state).await,
        ResourceType::Command => check_commands_updates(app_state).await,
        ResourceType::Hook => check_hooks_updates(app_state).await,
        ResourceType::Agent => check_agents_updates(app_state).await,
    }
}

// ========== 更新执行命令 ==========

use std::sync::Arc;

/// 内部函数：更新单个 Skill
///
/// 流程：
/// 1. 获取已安装的 Skill 信息
/// 2. 获取最新的 file_hash
/// 3. 重新下载并安装（覆盖现有文件）
/// 4. 更新数据库记录
async fn update_skill_internal(
    db: &Arc<Database>,
    skill_id: String,
) -> Result<SkillUpdateResult, AppError> {
    // 获取已安装的 Skill
    let installed = db
        .get_installed_skill(&skill_id)?
        .ok_or_else(|| AppError::Message(format!("Skill 不存在: {skill_id}")))?;

    // 检查是否有仓库信息（本地导入的无法更新）
    let repo_owner = installed.repo_owner.clone().ok_or_else(|| {
        AppError::Message("本地导入的 Skill 不支持更新".to_string())
    })?;
    let repo_name = installed.repo_name.clone().unwrap_or_default();
    let repo_branch = installed.repo_branch.clone().unwrap_or_else(|| "main".to_string());

    // 获取 GitHub Token
    let github_token = db.get_setting("github_pat")?;
    let update_service = UpdateService::new(github_token.clone());

    // 检查更新并获取新的 hash
    let check_result = update_service.check_skill_update(&installed).await;

    if !check_result.has_update {
        return Ok(SkillUpdateResult {
            id: skill_id,
            success: true,
            new_hash: installed.file_hash,
            error: Some("已是最新版本".to_string()),
        });
    }

    let new_hash = check_result.new_hash.clone();

    // 从 skill ID 中提取源路径（格式: owner/repo:path）
    // 例如: "tianzecn/myclaudecode:plugins/development/skills/telegram-dev" -> "plugins/development/skills/telegram-dev"
    let source_directory = installed
        .id
        .split(':')
        .nth(1)
        .map(|s| s.to_string())
        .unwrap_or_else(|| installed.directory.clone());

    // 构造 DiscoverableSkill 用于重新安装
    let discoverable = DiscoverableSkill {
        key: installed.id.clone(),
        name: installed.name.clone(),
        description: installed.description.clone().unwrap_or_default(),
        directory: source_directory, // 使用仓库中的完整路径，而非安装后的目录名
        namespace: installed.namespace.clone(),
        readme_url: installed.readme_url.clone(),
        repo_owner: repo_owner.clone(),
        repo_name: repo_name.clone(),
        repo_branch: repo_branch.clone(),
        file_hash: new_hash.clone(),
    };

    // 删除 SSOT 中的旧目录，强制重新下载
    let ssot_dir = SkillService::get_ssot_dir()
        .map_err(|e| AppError::Message(e.to_string()))?;
    let old_path = ssot_dir.join(&installed.directory);
    if old_path.exists() {
        log::info!("删除 SSOT 中的旧版本: {}", old_path.display());
        let _ = std::fs::remove_dir_all(&old_path);
    }

    // 确定当前启用的应用（用于安装时的同步）
    let current_app = if installed.apps.claude {
        AppType::Claude
    } else if installed.apps.codex {
        AppType::Codex
    } else {
        AppType::Gemini
    };

    // 重新安装（会覆盖现有文件）
    let skill_service = SkillService::new();

    match skill_service.install(db, &discoverable, &current_app).await {
        Ok(updated_skill) => {
            // 恢复原有的应用启用状态（install 只启用 current_app）
            db.update_skill_apps(&skill_id, &installed.apps)?;

            // 同步到其他启用的应用
            if installed.apps.claude && current_app != AppType::Claude {
                let _ = SkillService::copy_to_app(&installed.directory, &AppType::Claude);
            }
            if installed.apps.codex && current_app != AppType::Codex {
                let _ = SkillService::copy_to_app(&installed.directory, &AppType::Codex);
            }
            if installed.apps.gemini && current_app != AppType::Gemini {
                let _ = SkillService::copy_to_app(&installed.directory, &AppType::Gemini);
            }

            log::info!("Skill {} 更新成功", skill_id);
            Ok(SkillUpdateResult {
                id: skill_id,
                success: true,
                new_hash: updated_skill.file_hash,
                error: None,
            })
        }
        Err(e) => {
            log::error!("Skill {} 更新失败: {}", skill_id, e);
            Ok(SkillUpdateResult {
                id: skill_id,
                success: false,
                new_hash: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// 更新单个 Skill（Tauri 命令）
#[tauri::command]
pub async fn update_skill(
    app_state: State<'_, AppState>,
    skill_id: String,
) -> Result<SkillUpdateResult, AppError> {
    update_skill_internal(&app_state.db, skill_id).await
}

/// 批量更新 Skills
#[tauri::command]
pub async fn update_skills_batch(
    app_state: State<'_, AppState>,
    skill_ids: Vec<String>,
) -> Result<BatchUpdateResult, AppError> {
    let db = &app_state.db;
    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for skill_id in skill_ids {
        match update_skill_internal(db, skill_id.clone()).await {
            Ok(result) => {
                if result.success && result.error.is_none() {
                    success_count += 1;
                } else if result.error.as_deref() != Some("已是最新版本") {
                    failed_count += 1;
                }
                results.push(UpdateExecuteResult {
                    id: result.id,
                    success: result.success,
                    error: result.error,
                });
            }
            Err(e) => {
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: skill_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}

/// 修复缺少 file_hash 的 Skills
///
/// 遍历所有已安装的 Skills，为没有 file_hash 的项目从 GitHub 获取并更新
#[tauri::command]
pub async fn fix_skills_hash(
    app_state: State<'_, AppState>,
) -> Result<BatchUpdateResult, AppError> {
    use crate::services::github_api::GitHubApiService;

    let db = &app_state.db;
    let skills = db.get_all_installed_skills()?;
    let github_token = db.get_setting("github_pat")?;
    let github_api = GitHubApiService::new(github_token);

    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for skill in skills.values() {
        // 跳过本地导入的 Skill
        if skill.repo_owner.is_none() {
            continue;
        }

        // 跳过已有 hash 的 Skill
        if skill.file_hash.is_some() {
            continue;
        }

        let owner = skill.repo_owner.as_ref().unwrap();
        let repo = skill.repo_name.as_ref().unwrap();
        let branch = skill.repo_branch.as_ref().unwrap();

        // 从 skill ID 中提取源路径（格式: owner/repo:path）
        let source_path = skill
            .id
            .split(':')
            .nth(1)
            .unwrap_or(&skill.directory);

        // 从 GitHub 获取目录 hash
        match github_api
            .get_directory_hash(owner, repo, branch, source_path)
            .await
        {
            Ok(hash) => {
                // 更新数据库
                if let Err(e) = db.update_skill_file_hash(&skill.id, Some(&hash)) {
                    log::error!("更新 Skill {} hash 失败: {}", skill.id, e);
                    failed_count += 1;
                    results.push(UpdateExecuteResult {
                        id: skill.id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                } else {
                    log::info!("已修复 Skill {} 的 file_hash: {}", skill.name, hash);
                    success_count += 1;
                    results.push(UpdateExecuteResult {
                        id: skill.id.clone(),
                        success: true,
                        error: None,
                    });
                }
            }
            Err(e) => {
                log::warn!("获取 Skill {} hash 失败: {}", skill.name, e);
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: skill.id.clone(),
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}

// ========== Commands 更新命令 ==========

/// 单个 Command 更新结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandUpdateResult {
    pub id: String,
    pub success: bool,
    pub new_hash: Option<String>,
    pub error: Option<String>,
}

/// 内部函数：更新单个 Command
///
/// 流程：
/// 1. 获取已安装的 Command 信息
/// 2. 获取最新的 file_hash
/// 3. 重新下载并安装（覆盖现有文件）
/// 4. 更新数据库记录
async fn update_command_internal(
    db: &Arc<Database>,
    command_id: String,
) -> Result<CommandUpdateResult, AppError> {
    // 获取已安装的 Command
    let installed = db
        .get_installed_command(&command_id)?
        .ok_or_else(|| AppError::Message(format!("Command 不存在: {command_id}")))?;

    // 检查是否有仓库信息（本地导入的无法更新）
    let repo_owner = installed.repo_owner.clone().ok_or_else(|| {
        AppError::Message("本地导入的 Command 不支持更新".to_string())
    })?;
    let repo_name = installed.repo_name.clone().unwrap_or_default();
    let repo_branch = installed.repo_branch.clone().unwrap_or_else(|| "main".to_string());

    // 获取 GitHub Token
    let github_token = db.get_setting("github_pat")?;
    let update_service = UpdateService::new(github_token.clone());

    // 使用数据库中保存的 source_path
    let source_path = installed.source_path.clone().ok_or_else(|| {
        AppError::Message("Command 缺少 source_path，无法更新".to_string())
    })?;

    // 检查更新并获取新的 hash
    let check_result = update_service
        .check_file_resource_update(
            &command_id,
            Some(&repo_owner),
            Some(&repo_name),
            Some(&repo_branch),
            Some(&source_path),
            installed.file_hash.as_deref(),
        )
        .await;

    if !check_result.has_update {
        return Ok(CommandUpdateResult {
            id: command_id,
            success: true,
            new_hash: installed.file_hash,
            error: Some("已是最新版本".to_string()),
        });
    }

    let _new_hash = check_result.new_hash.clone();

    // 构造 DiscoverableCommand 用于重新安装
    let discoverable = DiscoverableCommand {
        key: installed.id.clone(),
        name: installed.name.clone(),
        description: installed.description.clone().unwrap_or_default(),
        namespace: installed.namespace.clone(),
        filename: installed.filename.clone(),
        category: installed.category.clone(),
        readme_url: installed.readme_url.clone(),
        repo_owner: repo_owner.clone(),
        repo_name: repo_name.clone(),
        repo_branch: repo_branch.clone(),
        source_path: Some(source_path.clone()),
    };

    // 删除 SSOT 中的旧文件，强制重新下载
    let ssot_dir = CommandService::get_ssot_dir()
        .map_err(|e| AppError::Message(e.to_string()))?;
    let old_path = ssot_dir.join(CommandService::id_to_relative_path(&installed.id));
    if old_path.exists() {
        log::info!("删除 SSOT 中的旧版本: {}", old_path.display());
        let _ = std::fs::remove_file(&old_path);
    }

    // 确定当前启用的应用（用于安装时的同步）
    let current_app = if installed.apps.claude {
        AppType::Claude
    } else if installed.apps.codex {
        AppType::Codex
    } else {
        AppType::Gemini
    };

    // 重新安装（会覆盖现有文件）
    let command_service = CommandService::new();

    match command_service.install(db, &discoverable, &current_app).await {
        Ok(updated_command) => {
            // 恢复原有的应用启用状态（install 只启用 current_app）
            db.update_command_apps(&command_id, &installed.apps)?;

            // 同步到其他启用的应用
            if installed.apps.claude && current_app != AppType::Claude {
                let _ = CommandService::copy_to_app(&installed.id, &AppType::Claude);
            }
            if installed.apps.codex && current_app != AppType::Codex {
                let _ = CommandService::copy_to_app(&installed.id, &AppType::Codex);
            }
            if installed.apps.gemini && current_app != AppType::Gemini {
                let _ = CommandService::copy_to_app(&installed.id, &AppType::Gemini);
            }

            log::info!("Command {} 更新成功", command_id);
            Ok(CommandUpdateResult {
                id: command_id,
                success: true,
                new_hash: updated_command.file_hash,
                error: None,
            })
        }
        Err(e) => {
            log::error!("Command {} 更新失败: {}", command_id, e);
            Ok(CommandUpdateResult {
                id: command_id,
                success: false,
                new_hash: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// 更新单个 Command（Tauri 命令）
#[tauri::command]
pub async fn update_command(
    app_state: State<'_, AppState>,
    command_id: String,
) -> Result<CommandUpdateResult, AppError> {
    update_command_internal(&app_state.db, command_id).await
}

/// 批量更新 Commands
#[tauri::command]
pub async fn update_commands_batch(
    app_state: State<'_, AppState>,
    command_ids: Vec<String>,
) -> Result<BatchUpdateResult, AppError> {
    let db = &app_state.db;
    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for command_id in command_ids {
        match update_command_internal(db, command_id.clone()).await {
            Ok(result) => {
                if result.success && result.error.is_none() {
                    success_count += 1;
                } else if result.error.as_deref() != Some("已是最新版本") {
                    failed_count += 1;
                }
                results.push(UpdateExecuteResult {
                    id: result.id,
                    success: result.success,
                    error: result.error,
                });
            }
            Err(e) => {
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: command_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}

/// 修复缺少 file_hash 的 Commands
///
/// 遍历所有已安装的 Commands，为没有 file_hash 的项目从 GitHub 获取并更新
#[tauri::command]
pub async fn fix_commands_hash(
    app_state: State<'_, AppState>,
) -> Result<BatchUpdateResult, AppError> {
    let db = &app_state.db;
    let commands = db.get_all_installed_commands()?;
    let github_token = db.get_setting("github_pat")?;
    let github_api = GitHubApiService::new(github_token);

    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for command in commands.values() {
        // 跳过本地导入的 Command
        if command.repo_owner.is_none() {
            continue;
        }

        // 跳过已有 hash 的 Command
        if command.file_hash.is_some() {
            continue;
        }

        let owner = command.repo_owner.as_ref().unwrap();
        let repo = command.repo_name.as_ref().unwrap();
        let branch = command.repo_branch.as_ref().unwrap();

        // 使用数据库中保存的 source_path
        let source_path = match &command.source_path {
            Some(p) => p.clone(),
            None => {
                log::warn!("Command {} 没有 source_path，跳过", command.name);
                continue;
            }
        };

        // 从 GitHub 获取文件 hash (返回 (sha, size) 元组)
        match github_api
            .get_file_blob_sha(owner, repo, branch, &source_path)
            .await
        {
            Ok((hash, _size)) => {
                // 更新数据库
                if let Err(e) = db.update_command_hash(&command.id, &hash) {
                    log::error!("更新 Command {} hash 失败: {}", command.id, e);
                    failed_count += 1;
                    results.push(UpdateExecuteResult {
                        id: command.id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                } else {
                    log::info!("已修复 Command {} 的 file_hash: {}", command.name, hash);
                    success_count += 1;
                    results.push(UpdateExecuteResult {
                        id: command.id.clone(),
                        success: true,
                        error: None,
                    });
                }
            }
            Err(e) => {
                log::warn!("获取 Command {} hash 失败: {}", command.name, e);
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: command.id.clone(),
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}

// ========== Agents 更新命令 ==========

/// 单个 Agent 更新结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentUpdateResult {
    pub id: String,
    pub success: bool,
    pub new_hash: Option<String>,
    pub error: Option<String>,
}

/// 内部函数：更新单个 Agent
///
/// 流程：
/// 1. 获取已安装的 Agent 信息
/// 2. 获取最新的 file_hash
/// 3. 重新下载并安装（覆盖现有文件）
/// 4. 更新数据库记录
async fn update_agent_internal(
    db: &Arc<Database>,
    agent_id: String,
) -> Result<AgentUpdateResult, AppError> {
    // 获取已安装的 Agent
    let installed = db
        .get_installed_agent(&agent_id)?
        .ok_or_else(|| AppError::Message(format!("Agent 不存在: {agent_id}")))?;

    // 检查是否有仓库信息（本地导入的无法更新）
    let repo_owner = installed.repo_owner.clone().ok_or_else(|| {
        AppError::Message("本地导入的 Agent 不支持更新".to_string())
    })?;
    let repo_name = installed.repo_name.clone().unwrap_or_default();
    let repo_branch = installed.repo_branch.clone().unwrap_or_else(|| "main".to_string());

    // 获取 GitHub Token
    let github_token = db.get_setting("github_pat")?;
    let update_service = UpdateService::new(github_token.clone());

    // 检查更新并获取新的 hash
    let check_result = update_service
        .check_file_resource_update(
            &agent_id,
            Some(&repo_owner),
            Some(&repo_name),
            Some(&repo_branch),
            installed.source_path.as_deref(),
            installed.file_hash.as_deref(),
        )
        .await;

    if !check_result.has_update {
        return Ok(AgentUpdateResult {
            id: agent_id,
            success: true,
            new_hash: installed.file_hash,
            error: Some("已是最新版本".to_string()),
        });
    }

    let _new_hash = check_result.new_hash.clone();

    // 构造 DiscoverableAgent 用于重新安装
    let discoverable = DiscoverableAgent {
        key: installed.id.clone(),
        name: installed.name.clone(),
        description: installed.description.clone().unwrap_or_default(),
        namespace: installed.namespace.clone(),
        filename: installed.filename.clone(),
        model: installed.model.clone(),
        tools: installed.tools.clone(),
        readme_url: installed.readme_url.clone(),
        repo_owner: repo_owner.clone(),
        repo_name: repo_name.clone(),
        repo_branch: repo_branch.clone(),
        source_path: installed.source_path.clone(),
    };

    // 删除 SSOT 中的旧文件，强制重新下载
    let ssot_dir = AgentService::get_ssot_dir()
        .map_err(|e| AppError::Message(e.to_string()))?;
    let old_path = ssot_dir.join(AgentService::id_to_relative_path(&installed.id));
    if old_path.exists() {
        log::info!("删除 SSOT 中的旧版本: {}", old_path.display());
        let _ = std::fs::remove_file(&old_path);
    }

    // 确定当前启用的应用（用于安装时的同步）
    let current_app = if installed.apps.claude {
        AppType::Claude
    } else if installed.apps.codex {
        AppType::Codex
    } else {
        AppType::Gemini
    };

    // 重新安装（会覆盖现有文件）
    let agent_service = AgentService::new();

    match agent_service.install(db, &discoverable, &current_app).await {
        Ok(updated_agent) => {
            // 恢复原有的应用启用状态（install 只启用 current_app）
            db.update_agent_apps(&agent_id, &installed.apps)?;

            // 同步到其他启用的应用
            if installed.apps.claude && current_app != AppType::Claude {
                let _ = AgentService::copy_to_app(&installed.id, &AppType::Claude);
            }
            if installed.apps.codex && current_app != AppType::Codex {
                let _ = AgentService::copy_to_app(&installed.id, &AppType::Codex);
            }
            if installed.apps.gemini && current_app != AppType::Gemini {
                let _ = AgentService::copy_to_app(&installed.id, &AppType::Gemini);
            }

            log::info!("Agent {} 更新成功", agent_id);
            Ok(AgentUpdateResult {
                id: agent_id,
                success: true,
                new_hash: updated_agent.file_hash,
                error: None,
            })
        }
        Err(e) => {
            log::error!("Agent {} 更新失败: {}", agent_id, e);
            Ok(AgentUpdateResult {
                id: agent_id,
                success: false,
                new_hash: None,
                error: Some(e.to_string()),
            })
        }
    }
}

/// 更新单个 Agent（Tauri 命令）
#[tauri::command]
pub async fn update_agent(
    app_state: State<'_, AppState>,
    agent_id: String,
) -> Result<AgentUpdateResult, AppError> {
    update_agent_internal(&app_state.db, agent_id).await
}

/// 批量更新 Agents
#[tauri::command]
pub async fn update_agents_batch(
    app_state: State<'_, AppState>,
    agent_ids: Vec<String>,
) -> Result<BatchUpdateResult, AppError> {
    let db = &app_state.db;
    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for agent_id in agent_ids {
        match update_agent_internal(db, agent_id.clone()).await {
            Ok(result) => {
                if result.success && result.error.is_none() {
                    success_count += 1;
                } else if result.error.as_deref() != Some("已是最新版本") {
                    failed_count += 1;
                }
                results.push(UpdateExecuteResult {
                    id: result.id,
                    success: result.success,
                    error: result.error,
                });
            }
            Err(e) => {
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: agent_id,
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}

/// 修复缺少 file_hash 的 Agents
///
/// 遍历所有已安装的 Agents，为没有 file_hash 的项目从 GitHub 获取并更新
#[tauri::command]
pub async fn fix_agents_hash(
    app_state: State<'_, AppState>,
) -> Result<BatchUpdateResult, AppError> {
    let db = &app_state.db;
    let agents = db.get_all_installed_agents()?;
    let github_token = db.get_setting("github_pat")?;
    let github_api = GitHubApiService::new(github_token);

    let mut results = Vec::new();
    let mut success_count = 0u32;
    let mut failed_count = 0u32;

    for agent in agents.values() {
        // 跳过本地导入的 Agent
        if agent.repo_owner.is_none() {
            continue;
        }

        // 跳过已有 hash 的 Agent
        if agent.file_hash.is_some() {
            continue;
        }

        let owner = agent.repo_owner.as_ref().unwrap();
        let repo = agent.repo_name.as_ref().unwrap();
        let branch = agent.repo_branch.as_ref().unwrap();

        // 使用 source_path 作为文件路径
        let source_path = match &agent.source_path {
            Some(p) => p.clone(),
            None => {
                log::warn!("Agent {} 没有 source_path，跳过", agent.name);
                continue;
            }
        };

        // 从 GitHub 获取文件 hash (返回 (sha, size) 元组)
        match github_api
            .get_file_blob_sha(owner, repo, branch, &source_path)
            .await
        {
            Ok((hash, _size)) => {
                // 更新数据库
                if let Err(e) = db.update_agent_hash(&agent.id, &hash) {
                    log::error!("更新 Agent {} hash 失败: {}", agent.id, e);
                    failed_count += 1;
                    results.push(UpdateExecuteResult {
                        id: agent.id.clone(),
                        success: false,
                        error: Some(e.to_string()),
                    });
                } else {
                    log::info!("已修复 Agent {} 的 file_hash: {}", agent.name, hash);
                    success_count += 1;
                    results.push(UpdateExecuteResult {
                        id: agent.id.clone(),
                        success: true,
                        error: None,
                    });
                }
            }
            Err(e) => {
                log::warn!("获取 Agent {} hash 失败: {}", agent.name, e);
                failed_count += 1;
                results.push(UpdateExecuteResult {
                    id: agent.id.clone(),
                    success: false,
                    error: Some(e.to_string()),
                });
            }
        }
    }

    Ok(BatchUpdateResult {
        success_count,
        failed_count,
        results,
    })
}
