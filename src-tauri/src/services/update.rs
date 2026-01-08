//! 资源更新服务
//!
//! 提供 Skills/Commands/Hooks/Agents 的更新检测和执行功能：
//! - 批量检查多个资源的更新状态
//! - 单个资源更新
//! - 批量更新
//! - 并发控制（最多 5 个并发请求）

use crate::app_config::InstalledSkill;
use crate::database::Database;
use crate::error::AppError;
use crate::services::github_api::{GitHubApiError, GitHubApiService, UpdateCheckResult};
use futures::stream::{self, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Semaphore;

/// 最大并发请求数
const MAX_CONCURRENT_REQUESTS: usize = 5;

/// 资源类型
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ResourceType {
    Skill,
    Command,
    Hook,
    Agent,
}

impl std::fmt::Display for ResourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Skill => write!(f, "Skill"),
            Self::Command => write!(f, "Command"),
            Self::Hook => write!(f, "Hook"),
            Self::Agent => write!(f, "Agent"),
        }
    }
}

/// 更新检测进度
#[derive(Debug, Clone, Serialize)]
pub struct UpdateCheckProgress {
    /// 当前检查的资源索引
    pub current: u32,
    /// 总资源数
    pub total: u32,
    /// 当前检查的资源名称
    pub current_name: String,
}

/// 批量更新检测结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchCheckResult {
    /// 成功检测的数量
    pub success_count: u32,
    /// 失败的数量
    pub failed_count: u32,
    /// 有更新的数量
    pub update_count: u32,
    /// 远程已删除的数量
    pub deleted_count: u32,
    /// 各资源的检测结果
    pub results: Vec<UpdateCheckResult>,
}

/// 更新执行结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateExecuteResult {
    /// 资源 ID
    pub id: String,
    /// 是否成功
    pub success: bool,
    /// 错误信息（如果失败）
    pub error: Option<String>,
}

/// 批量更新执行结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchUpdateResult {
    /// 成功数量
    pub success_count: u32,
    /// 失败数量
    pub failed_count: u32,
    /// 各资源的更新结果
    pub results: Vec<UpdateExecuteResult>,
}

/// 更新服务
pub struct UpdateService {
    github_api: Arc<GitHubApiService>,
    semaphore: Arc<Semaphore>,
}

impl Default for UpdateService {
    fn default() -> Self {
        Self::new(None)
    }
}

impl UpdateService {
    /// 创建新的 UpdateService 实例
    pub fn new(github_token: Option<String>) -> Self {
        Self {
            github_api: Arc::new(GitHubApiService::new(github_token)),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_REQUESTS)),
        }
    }

    // ========== Skills 更新检测 ==========

    /// 检查单个 Skill 的更新
    pub async fn check_skill_update(&self, skill: &InstalledSkill) -> UpdateCheckResult {
        // 本地导入的 Skill 没有远程仓库，不支持更新检测
        if skill.repo_owner.is_none() {
            return UpdateCheckResult {
                id: skill.id.clone(),
                has_update: false,
                new_hash: None,
                commit_message: None,
                updated_at: None,
                error: Some("本地导入的 Skill 不支持更新检测".to_string()),
                remote_deleted: false,
            };
        }

        let owner = skill.repo_owner.as_ref().unwrap();
        let repo = skill.repo_name.as_ref().unwrap();
        let branch = skill.repo_branch.as_ref().unwrap();

        // 从 skill ID 中提取源路径（格式: owner/repo:path）
        let source_path = skill
            .id
            .split(':')
            .nth(1)
            .map(|s| s.to_string())
            .unwrap_or_else(|| skill.directory.clone());

        log::info!(
            "[UpdateCheck] Skill: {} | Path: {} | Owner: {} | Repo: {} | Branch: {}",
            skill.id, source_path, owner, repo, branch
        );
        log::info!(
            "[UpdateCheck] Current file_hash in DB: {:?}",
            skill.file_hash
        );

        // 尝试获取目录的组合 hash
        let hash_result = self
            .github_api
            .get_directory_hash(owner, repo, branch, &source_path)
            .await;

        match hash_result {
            Ok(new_hash) => {
                log::info!("[UpdateCheck] New hash from GitHub: {}", new_hash);
                let has_update = skill.file_hash.as_ref() != Some(&new_hash);
                log::info!(
                    "[UpdateCheck] has_update = {} (DB: {:?} vs GitHub: {})",
                    has_update,
                    skill.file_hash,
                    new_hash
                );

                // 如果有更新，获取最新 commit 信息
                let (commit_message, updated_at) = if has_update {
                    match self
                        .github_api
                        .get_latest_commit(owner, repo, branch, Some(&source_path))
                        .await
                    {
                        Ok((msg, ts)) => (Some(msg), Some(ts)),
                        Err(_) => (None, None),
                    }
                } else {
                    (None, None)
                };

                UpdateCheckResult {
                    id: skill.id.clone(),
                    has_update,
                    new_hash: if has_update { Some(new_hash) } else { None },
                    commit_message,
                    updated_at,
                    error: None,
                    remote_deleted: false,
                }
            }
            Err(GitHubApiError::NotFound) => {
                // 尝试使用默认分支
                match self.github_api.get_default_branch(owner, repo).await {
                    Ok(default_branch) if &default_branch != branch => {
                        // 使用默认分支重试
                        match self
                            .github_api
                            .get_directory_hash(owner, repo, &default_branch, &source_path)
                            .await
                        {
                            Ok(new_hash) => {
                                let has_update = skill.file_hash.as_ref() != Some(&new_hash);
                                let (commit_message, updated_at) = if has_update {
                                    self.github_api
                                        .get_latest_commit(
                                            owner,
                                            repo,
                                            &default_branch,
                                            Some(&source_path),
                                        )
                                        .await
                                        .ok()
                                        .map(|(m, t)| (Some(m), Some(t)))
                                        .unwrap_or((None, None))
                                } else {
                                    (None, None)
                                };

                                UpdateCheckResult {
                                    id: skill.id.clone(),
                                    has_update,
                                    new_hash: if has_update { Some(new_hash) } else { None },
                                    commit_message,
                                    updated_at,
                                    error: None,
                                    remote_deleted: false,
                                }
                            }
                            Err(GitHubApiError::NotFound) => UpdateCheckResult {
                                id: skill.id.clone(),
                                has_update: false,
                                new_hash: None,
                                commit_message: None,
                                updated_at: None,
                                error: None,
                                remote_deleted: true,
                            },
                            Err(e) => UpdateCheckResult {
                                id: skill.id.clone(),
                                has_update: false,
                                new_hash: None,
                                commit_message: None,
                                updated_at: None,
                                error: Some(e.to_string()),
                                remote_deleted: false,
                            },
                        }
                    }
                    Ok(_) | Err(GitHubApiError::NotFound) => {
                        // 默认分支也找不到，标记为远程已删除
                        UpdateCheckResult {
                            id: skill.id.clone(),
                            has_update: false,
                            new_hash: None,
                            commit_message: None,
                            updated_at: None,
                            error: None,
                            remote_deleted: true,
                        }
                    }
                    Err(e) => UpdateCheckResult {
                        id: skill.id.clone(),
                        has_update: false,
                        new_hash: None,
                        commit_message: None,
                        updated_at: None,
                        error: Some(e.to_string()),
                        remote_deleted: false,
                    },
                }
            }
            Err(e) => UpdateCheckResult {
                id: skill.id.clone(),
                has_update: false,
                new_hash: None,
                commit_message: None,
                updated_at: None,
                error: Some(e.to_string()),
                remote_deleted: false,
            },
        }
    }

    /// 批量检查 Skills 更新
    pub async fn check_skills_updates(&self, db: &Database) -> Result<BatchCheckResult, AppError> {
        let skills = db.get_all_installed_skills()?;
        let skills_vec: Vec<InstalledSkill> = skills.into_values().collect();

        self.check_skills_updates_batch(skills_vec).await
    }

    /// 批量检查指定的 Skills 更新
    pub async fn check_skills_updates_batch(
        &self,
        skills: Vec<InstalledSkill>,
    ) -> Result<BatchCheckResult, AppError> {
        let semaphore = self.semaphore.clone();
        let github_api = self.github_api.clone();

        let results: Vec<UpdateCheckResult> = stream::iter(skills.into_iter())
            .map(|skill| {
                let sem = semaphore.clone();
                let api = github_api.clone();

                async move {
                    let _permit = sem.acquire().await.unwrap();
                    let service = UpdateService {
                        github_api: api,
                        semaphore: Arc::new(Semaphore::new(1)),
                    };
                    service.check_skill_update(&skill).await
                }
            })
            .buffer_unordered(MAX_CONCURRENT_REQUESTS)
            .collect()
            .await;

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

    // ========== 通用更新检测（用于 Commands/Hooks/Agents） ==========

    /// 检查单个文件资源的更新（适用于 Commands/Hooks/Agents）
    pub async fn check_file_resource_update(
        &self,
        id: &str,
        repo_owner: Option<&str>,
        repo_name: Option<&str>,
        repo_branch: Option<&str>,
        source_path: Option<&str>,
        current_hash: Option<&str>,
    ) -> UpdateCheckResult {
        // 没有仓库信息的资源不支持更新检测
        if repo_owner.is_none() || source_path.is_none() {
            return UpdateCheckResult {
                id: id.to_string(),
                has_update: false,
                new_hash: None,
                commit_message: None,
                updated_at: None,
                error: Some("本地资源不支持更新检测".to_string()),
                remote_deleted: false,
            };
        }

        let owner = repo_owner.unwrap();
        let repo = repo_name.unwrap_or("unknown");
        let branch = repo_branch.unwrap_or("main");
        let path = source_path.unwrap();

        // 获取文件的 blob SHA
        let hash_result = self
            .github_api
            .get_file_blob_sha(owner, repo, branch, path)
            .await;

        match hash_result {
            Ok((new_hash, _size)) => {
                let has_update = current_hash != Some(&new_hash);

                let (commit_message, updated_at) = if has_update {
                    self.github_api
                        .get_latest_commit(owner, repo, branch, Some(path))
                        .await
                        .ok()
                        .map(|(m, t)| (Some(m), Some(t)))
                        .unwrap_or((None, None))
                } else {
                    (None, None)
                };

                UpdateCheckResult {
                    id: id.to_string(),
                    has_update,
                    new_hash: if has_update { Some(new_hash) } else { None },
                    commit_message,
                    updated_at,
                    error: None,
                    remote_deleted: false,
                }
            }
            Err(GitHubApiError::NotFound) => UpdateCheckResult {
                id: id.to_string(),
                has_update: false,
                new_hash: None,
                commit_message: None,
                updated_at: None,
                error: None,
                remote_deleted: true,
            },
            Err(e) => UpdateCheckResult {
                id: id.to_string(),
                has_update: false,
                new_hash: None,
                commit_message: None,
                updated_at: None,
                error: Some(e.to_string()),
                remote_deleted: false,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_type_display() {
        assert_eq!(ResourceType::Skill.to_string(), "Skill");
        assert_eq!(ResourceType::Command.to_string(), "Command");
        assert_eq!(ResourceType::Hook.to_string(), "Hook");
        assert_eq!(ResourceType::Agent.to_string(), "Agent");
    }

    #[test]
    fn test_batch_check_result_empty() {
        let result = BatchCheckResult {
            success_count: 0,
            failed_count: 0,
            update_count: 0,
            deleted_count: 0,
            results: vec![],
        };
        assert_eq!(result.success_count, 0);
    }
}
