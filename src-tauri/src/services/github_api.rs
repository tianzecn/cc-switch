//! GitHub API 服务
//!
//! 提供 GitHub API 调用功能，用于资源更新检测：
//! - 获取文件/目录的 blob SHA
//! - 检测远程资源是否有更新
//! - 支持可选的 GitHub Personal Access Token

use crate::error::AppError;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::time::Duration;

// ========== 数据结构 ==========

/// GitHub Tree 响应结构
#[derive(Debug, Deserialize)]
pub struct GitHubTreeResponse {
    pub sha: String,
    pub tree: Vec<GitHubTreeEntry>,
    pub truncated: bool,
}

/// GitHub Tree 条目
#[derive(Debug, Deserialize)]
pub struct GitHubTreeEntry {
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String, // "blob" or "tree"
    pub sha: String,
    #[serde(default)]
    pub size: Option<u64>,
}

/// GitHub 仓库信息（用于获取默认分支）
#[derive(Debug, Deserialize)]
pub struct GitHubRepoInfo {
    pub default_branch: String,
}

/// 更新检测结果
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    /// 资源 ID
    pub id: String,
    /// 是否有更新
    pub has_update: bool,
    /// 新的 blob SHA（如果有更新）
    pub new_hash: Option<String>,
    /// 最新 commit 消息（如果可获取）
    pub commit_message: Option<String>,
    /// 更新时间（Unix 时间戳）
    pub updated_at: Option<i64>,
    /// 错误信息（如果检测失败）
    pub error: Option<String>,
    /// 远程是否已删除
    pub remote_deleted: bool,
}

/// 批量更新检测结果
#[derive(Debug, Clone, Serialize)]
pub struct BatchUpdateCheckResult {
    /// 成功检测的数量
    pub success_count: u32,
    /// 失败的数量
    pub failed_count: u32,
    /// 有更新的数量
    pub update_count: u32,
    /// 各资源的检测结果
    pub results: Vec<UpdateCheckResult>,
}

/// GitHub API 速率限制信息
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RateLimitInfo {
    /// 剩余请求次数
    pub remaining: u32,
    /// 总配额
    pub limit: u32,
    /// 重置时间（Unix 时间戳）
    pub reset_at: i64,
}

/// GitHub API 错误类型
#[derive(Debug, Clone, PartialEq)]
pub enum GitHubApiError {
    /// 速率限制
    RateLimited(RateLimitInfo),
    /// 未找到（404）
    NotFound,
    /// 网络错误
    NetworkError(String),
    /// 认证失败
    Unauthorized,
    /// 其他错误
    Other(String),
}

impl std::fmt::Display for GitHubApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::RateLimited(info) => {
                write!(
                    f,
                    "GitHub API 速率限制（剩余 {}/{}，{}秒后重置）",
                    info.remaining,
                    info.limit,
                    info.reset_at - chrono::Utc::now().timestamp()
                )
            }
            Self::NotFound => write!(f, "资源不存在"),
            Self::NetworkError(msg) => write!(f, "网络错误: {msg}"),
            Self::Unauthorized => write!(f, "认证失败，请检查 Token"),
            Self::Other(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<GitHubApiError> for AppError {
    fn from(e: GitHubApiError) -> Self {
        AppError::Message(e.to_string())
    }
}

// ========== GitHub API Service ==========

/// GitHub API 服务
pub struct GitHubApiService {
    http_client: Client,
    /// 可选的 GitHub Personal Access Token
    token: Option<String>,
}

impl Default for GitHubApiService {
    fn default() -> Self {
        Self::new(None)
    }
}

impl GitHubApiService {
    /// 创建新的 GitHubApiService 实例
    pub fn new(token: Option<String>) -> Self {
        Self {
            http_client: Client::builder()
                .user_agent("CC-Switch/3.9")
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
            token,
        }
    }

    /// 使用 Token 创建实例
    pub fn with_token(token: String) -> Self {
        Self::new(Some(token))
    }

    /// 设置/更新 Token
    pub fn set_token(&mut self, token: Option<String>) {
        self.token = token;
    }

    /// 构建带认证的请求
    fn build_request(&self, url: &str) -> reqwest::RequestBuilder {
        let mut req = self.http_client.get(url);
        if let Some(ref token) = self.token {
            req = req.bearer_auth(token);
        }
        req.header("Accept", "application/vnd.github.v3+json")
    }

    /// 解析速率限制响应头
    fn parse_rate_limit(&self, headers: &reqwest::header::HeaderMap) -> Option<RateLimitInfo> {
        let remaining = headers
            .get("x-ratelimit-remaining")?
            .to_str()
            .ok()?
            .parse()
            .ok()?;
        let limit = headers
            .get("x-ratelimit-limit")?
            .to_str()
            .ok()?
            .parse()
            .ok()?;
        let reset_at = headers
            .get("x-ratelimit-reset")?
            .to_str()
            .ok()?
            .parse()
            .ok()?;

        Some(RateLimitInfo {
            remaining,
            limit,
            reset_at,
        })
    }

    /// 获取仓库的默认分支
    pub async fn get_default_branch(
        &self,
        owner: &str,
        repo: &str,
    ) -> Result<String, GitHubApiError> {
        let url = format!("https://api.github.com/repos/{owner}/{repo}");

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        let status = response.status();
        let headers = response.headers().clone();

        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(GitHubApiError::NotFound);
        }

        if status == reqwest::StatusCode::UNAUTHORIZED
            || status == reqwest::StatusCode::FORBIDDEN
        {
            if let Some(rate_limit) = self.parse_rate_limit(&headers) {
                if rate_limit.remaining == 0 {
                    return Err(GitHubApiError::RateLimited(rate_limit));
                }
            }
            return Err(GitHubApiError::Unauthorized);
        }

        if !status.is_success() {
            return Err(GitHubApiError::Other(format!(
                "HTTP {}: 获取仓库信息失败",
                status
            )));
        }

        let repo_info: GitHubRepoInfo = response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析响应失败: {e}")))?;

        Ok(repo_info.default_branch)
    }

    /// 获取指定路径的 Tree（递归）
    ///
    /// 用于获取目录下所有文件的 blob SHA
    pub async fn get_tree(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        path: &str,
    ) -> Result<GitHubTreeResponse, GitHubApiError> {
        // 首先获取分支的 commit SHA
        let ref_url = format!(
            "https://api.github.com/repos/{owner}/{repo}/git/refs/heads/{branch}"
        );

        let ref_response = self
            .build_request(&ref_url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        if ref_response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(GitHubApiError::NotFound);
        }

        if !ref_response.status().is_success() {
            return Err(GitHubApiError::Other(format!(
                "获取分支引用失败: HTTP {}",
                ref_response.status()
            )));
        }

        #[derive(Deserialize)]
        struct RefObject {
            sha: String,
        }
        #[derive(Deserialize)]
        struct RefResponse {
            object: RefObject,
        }

        let ref_data: RefResponse = ref_response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析分支引用失败: {e}")))?;

        // 获取 commit 的 tree SHA
        let commit_url = format!(
            "https://api.github.com/repos/{owner}/{repo}/git/commits/{}",
            ref_data.object.sha
        );

        let commit_response = self
            .build_request(&commit_url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        #[derive(Deserialize)]
        struct TreeRef {
            sha: String,
        }
        #[derive(Deserialize)]
        struct CommitResponse {
            tree: TreeRef,
        }

        let commit_data: CommitResponse = commit_response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析 commit 失败: {e}")))?;

        // 获取递归 tree
        let tree_url = format!(
            "https://api.github.com/repos/{owner}/{repo}/git/trees/{}?recursive=1",
            commit_data.tree.sha
        );

        let tree_response = self
            .build_request(&tree_url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        let status = tree_response.status();
        let headers = tree_response.headers().clone();

        if status == reqwest::StatusCode::FORBIDDEN {
            if let Some(rate_limit) = self.parse_rate_limit(&headers) {
                if rate_limit.remaining == 0 {
                    return Err(GitHubApiError::RateLimited(rate_limit));
                }
            }
        }

        if !status.is_success() {
            return Err(GitHubApiError::Other(format!(
                "获取 tree 失败: HTTP {}",
                status
            )));
        }

        let mut tree_data: GitHubTreeResponse = tree_response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析 tree 失败: {e}")))?;

        // 如果指定了路径，过滤出该路径下的条目
        if !path.is_empty() {
            let prefix = if path.ends_with('/') {
                path.to_string()
            } else {
                format!("{path}/")
            };

            tree_data.tree = tree_data
                .tree
                .into_iter()
                .filter(|entry| entry.path.starts_with(&prefix) || entry.path == path)
                .collect();
        }

        Ok(tree_data)
    }

    /// 获取单个文件的 blob SHA
    ///
    /// 返回文件的 SHA 和内容大小
    pub async fn get_file_blob_sha(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        path: &str,
    ) -> Result<(String, u64), GitHubApiError> {
        let url = format!(
            "https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}"
        );

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        let status = response.status();
        let headers = response.headers().clone();

        if status == reqwest::StatusCode::NOT_FOUND {
            return Err(GitHubApiError::NotFound);
        }

        if status == reqwest::StatusCode::FORBIDDEN {
            if let Some(rate_limit) = self.parse_rate_limit(&headers) {
                if rate_limit.remaining == 0 {
                    return Err(GitHubApiError::RateLimited(rate_limit));
                }
            }
            return Err(GitHubApiError::Unauthorized);
        }

        if !status.is_success() {
            return Err(GitHubApiError::Other(format!(
                "获取文件信息失败: HTTP {}",
                status
            )));
        }

        #[derive(Deserialize)]
        struct ContentsResponse {
            sha: String,
            size: u64,
        }

        let data: ContentsResponse = response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析响应失败: {e}")))?;

        Ok((data.sha, data.size))
    }

    /// 计算目录的组合 hash
    ///
    /// 将目录下所有文件的 blob SHA 组合后计算 hash，
    /// 用于检测目录内任意文件是否有变化
    pub async fn get_directory_hash(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        path: &str,
    ) -> Result<String, GitHubApiError> {
        let tree = self.get_tree(owner, repo, branch, path).await?;

        // 只取 blob 类型的条目，按路径排序
        let mut blobs: Vec<&GitHubTreeEntry> = tree
            .tree
            .iter()
            .filter(|e| e.entry_type == "blob")
            .collect();

        blobs.sort_by(|a, b| a.path.cmp(&b.path));

        if blobs.is_empty() {
            return Err(GitHubApiError::NotFound);
        }

        // 组合所有 blob SHA
        let combined: String = blobs.iter().map(|b| b.sha.as_str()).collect();

        // 计算 SHA256 hash
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(combined.as_bytes());
        let result = hasher.finalize();

        Ok(format!("{:x}", result))
    }

    /// 获取最新 commit 信息
    pub async fn get_latest_commit(
        &self,
        owner: &str,
        repo: &str,
        branch: &str,
        path: Option<&str>,
    ) -> Result<(String, i64), GitHubApiError> {
        let mut url = format!(
            "https://api.github.com/repos/{owner}/{repo}/commits?sha={branch}&per_page=1"
        );

        if let Some(p) = path {
            url.push_str(&format!("&path={p}"));
        }

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(GitHubApiError::Other(format!(
                "获取 commit 失败: HTTP {}",
                response.status()
            )));
        }

        #[derive(Deserialize)]
        struct CommitInfo {
            message: String,
        }
        #[derive(Deserialize)]
        struct Committer {
            date: String,
        }
        #[derive(Deserialize)]
        struct CommitDetail {
            committer: Committer,
        }
        #[derive(Deserialize)]
        struct CommitResponse {
            commit: CommitDetail,
            #[serde(flatten)]
            info: CommitInfo,
        }

        let commits: Vec<serde_json::Value> = response
            .json()
            .await
            .map_err(|e| GitHubApiError::Other(format!("解析响应失败: {e}")))?;

        if commits.is_empty() {
            return Err(GitHubApiError::NotFound);
        }

        let commit = &commits[0];
        let message = commit["commit"]["message"]
            .as_str()
            .unwrap_or("")
            .lines()
            .next()
            .unwrap_or("")
            .to_string();

        let date_str = commit["commit"]["committer"]["date"]
            .as_str()
            .unwrap_or("");

        let timestamp = chrono::DateTime::parse_from_rfc3339(date_str)
            .map(|dt| dt.timestamp())
            .unwrap_or(0);

        Ok((message, timestamp))
    }

    /// 验证 Token 有效性
    pub async fn validate_token(&self) -> Result<RateLimitInfo, GitHubApiError> {
        let url = "https://api.github.com/rate_limit";

        let response = self
            .build_request(url)
            .send()
            .await
            .map_err(|e| GitHubApiError::NetworkError(e.to_string()))?;

        let headers = response.headers().clone();

        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubApiError::Unauthorized);
        }

        self.parse_rate_limit(&headers)
            .ok_or_else(|| GitHubApiError::Other("无法解析速率限制信息".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rate_limit_display() {
        let info = RateLimitInfo {
            remaining: 10,
            limit: 60,
            reset_at: chrono::Utc::now().timestamp() + 3600,
        };
        let error = GitHubApiError::RateLimited(info);
        let display = error.to_string();
        assert!(display.contains("速率限制"));
    }

    #[test]
    fn test_github_api_error_conversion() {
        let error = GitHubApiError::NotFound;
        let app_error: AppError = error.into();
        assert!(matches!(app_error, AppError::Message(_)));
    }
}
