//! 项目管理命令
//!
//! 提供 Claude Code 项目发现相关的 Tauri 命令：
//! - 获取所有项目列表

use crate::services::{ProjectInfo, ProjectService};

/// 获取所有 Claude Code 项目
///
/// 从 `~/.claude/projects/` 目录读取用户使用过的项目列表
#[tauri::command]
pub fn get_all_projects() -> Result<Vec<ProjectInfo>, String> {
    ProjectService::get_all_projects().map_err(|e| e.to_string())
}
