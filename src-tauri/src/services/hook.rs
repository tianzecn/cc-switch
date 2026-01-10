//! Hook 服务层
//!
//! 提供 Hook 管理的核心业务逻辑：
//! - 安装/卸载 Hooks
//! - 同步到各应用 settings.json 的 hooks 字段
//! - 发现可用 Hooks（GitHub 仓库扫描）
//! - 命名空间管理
//! - 优先级排序
//!
//! ## 目录结构
//!
//! - SSOT: `~/.cc-switch/hooks/`
//! - Claude: `~/.claude/settings.json` → hooks 字段
//! - Codex: `~/.codex/settings.json` → hooks 字段
//! - Gemini: `~/.gemini/settings.json` → hooks 字段
//!
//! ## Hook 文件格式 (JSON)
//!
//! ```json
//! {
//!   "name": "Pre-Bash Security Check",
//!   "description": "在执行 Bash 命令前进行安全检查",
//!   "event_type": "PreToolUse",
//!   "rules": [
//!     {
//!       "matcher": "Bash",
//!       "hooks": [
//!         { "type": "command", "command": "/path/to/check.sh" }
//!       ]
//!     }
//!   ],
//!   "priority": 10,
//!   "enabled": true
//! }
//! ```

use crate::app_config::{
    AppType, CommandRepo, DiscoverableHook, HookApps, HookEventType, HookNamespace, HookRule,
    HookType, InstallScope, InstalledHook, UnmanagedHook,
};
use crate::config::get_app_config_dir;
use crate::database::Database;
use crate::services::github_api::GitHubApiService;
use anyhow::{anyhow, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::time::timeout;

/// Hook 文件元数据（从 JSON 解析）
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HookFileMetadata {
    /// 显示名称
    pub name: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 事件类型
    pub event_type: Option<HookEventType>,
    /// 规则列表
    #[serde(default)]
    pub rules: Vec<HookRule>,
    /// 优先级
    #[serde(default = "default_priority")]
    pub priority: i32,
    /// 是否启用
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_priority() -> i32 {
    100
}

fn default_enabled() -> bool {
    true
}

/// Claude Code 官方 hooks 配置格式
/// 格式：{ "hooks": { "PreToolUse": [...], "PostToolUse": [...], ... } }
#[derive(Debug, Clone, Deserialize, Default)]
pub struct OfficialHooksFormat {
    /// hooks 对象，键为事件类型名称
    pub hooks: Option<HashMap<String, Vec<OfficialHookRule>>>,
}

/// 官方格式中的单个规则
#[derive(Debug, Clone, Deserialize)]
pub struct OfficialHookRule {
    /// 匹配器
    pub matcher: Option<String>,
    /// hooks 命令列表
    pub hooks: Vec<OfficialHookCommand>,
}

/// 官方格式中的命令
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "lowercase")]
pub struct OfficialHookCommand {
    /// 命令类型
    #[serde(rename = "type")]
    pub cmd_type: String,
    /// 命令内容
    pub command: Option<String>,
    /// 超时时间（毫秒）- 保留用于反序列化兼容
    #[allow(dead_code)]
    pub timeout: Option<u64>,
}

impl OfficialHooksFormat {
    /// 将官方格式转换为 CC Switch 的 HookFileMetadata 列表
    pub fn to_hook_metadata_list(&self) -> Vec<(HookEventType, HookFileMetadata)> {
        let mut result = Vec::new();

        if let Some(hooks) = &self.hooks {
            for (event_name, rules) in hooks {
                // 解析事件类型
                let event_type = match event_name.as_str() {
                    "PreToolUse" => HookEventType::PreToolUse,
                    "PostToolUse" => HookEventType::PostToolUse,
                    "PermissionRequest" => HookEventType::PermissionRequest,
                    "SessionEnd" => HookEventType::SessionEnd,
                    // 跳过不支持的事件类型（如 SessionStart）
                    _ => continue,
                };

                // 转换规则
                let converted_rules: Vec<HookRule> = rules
                    .iter()
                    .map(|r| HookRule {
                        matcher: r.matcher.clone().unwrap_or_default(),
                        hooks: r
                            .hooks
                            .iter()
                            .filter_map(|h| {
                                // 将官方格式的命令转换为 HookType
                                match h.cmd_type.as_str() {
                                    "command" => h
                                        .command
                                        .clone()
                                        .map(|cmd| HookType::Command { command: cmd }),
                                    "prompt" => h
                                        .command
                                        .clone()
                                        .map(|prompt| HookType::Prompt { prompt }),
                                    _ => None,
                                }
                            })
                            .collect(),
                    })
                    .collect();

                if !converted_rules.is_empty() {
                    result.push((
                        event_type.clone(),
                        HookFileMetadata {
                            name: None,
                            description: None,
                            event_type: Some(event_type),
                            rules: converted_rules,
                            priority: default_priority(),
                            enabled: default_enabled(),
                        },
                    ));
                }
            }
        }

        result
    }
}

/// Hook 服务
pub struct HookService {
    http_client: Client,
}

impl Default for HookService {
    fn default() -> Self {
        Self::new()
    }
}

impl HookService {
    /// 创建新的 HookService 实例
    pub fn new() -> Self {
        Self {
            http_client: Client::builder()
                .user_agent("CC-Switch/3.9")
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    // ========== 路径管理 ==========

    /// 获取 SSOT 目录路径
    ///
    /// 返回 `~/.cc-switch/hooks/`
    pub fn get_ssot_dir() -> Result<PathBuf> {
        let dir = get_app_config_dir().join("hooks");
        if !dir.exists() {
            fs::create_dir_all(&dir)?;
        }
        Ok(dir)
    }

    /// 获取指定应用的 settings.json 路径
    ///
    /// - Claude: `~/.claude/settings.json`
    /// - Codex: `~/.codex/settings.json`
    /// - Gemini: `~/.gemini/settings.json`
    pub fn get_app_settings_path(app: &AppType) -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| anyhow!("无法获取用户主目录"))?;

        let path = match app {
            AppType::Claude => home.join(".claude").join("settings.json"),
            AppType::Codex => home.join(".codex").join("settings.json"),
            AppType::Gemini => home.join(".gemini").join("settings.json"),
        };

        Ok(path)
    }

    /// 获取项目级 Hooks 目录
    ///
    /// 项目级安装目录：`<project_path>/.claude/hooks/`
    pub fn get_project_hooks_dir(project_path: &Path) -> Result<PathBuf> {
        let hooks_dir = project_path.join(".claude").join("hooks");
        Ok(hooks_dir)
    }

    /// 检查范围冲突
    pub fn check_scope_conflict(
        db: &Arc<Database>,
        id: &str,
        new_scope: &InstallScope,
    ) -> Result<()> {
        if let Some(existing) = db.get_installed_hook(id)? {
            let current_scope =
                InstallScope::from_db(&existing.scope, existing.project_path.as_deref());

            if current_scope == *new_scope {
                return Ok(());
            }

            let conflict_msg = match (&current_scope, new_scope) {
                (InstallScope::Global, InstallScope::Project(_)) => {
                    "该 Hook 已安装到全局，请先移除全局安装后再安装到项目"
                }
                (InstallScope::Project(_), InstallScope::Global) => {
                    "该 Hook 已安装到项目，请先移除项目安装后再安装到全局"
                }
                (InstallScope::Project(old_path), InstallScope::Project(new_path)) => {
                    return Err(anyhow!(
                        "该 Hook 已安装到项目 {}，请先移除后再安装到项目 {}",
                        old_path.display(),
                        new_path.display()
                    ));
                }
                _ => "安装范围冲突",
            };

            return Err(anyhow!(conflict_msg));
        }

        Ok(())
    }

    /// 复制 Hook 到项目目录
    pub fn copy_to_project(id: &str, project_path: &Path) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let source = ssot_dir.join(&relative_path);

        if !source.exists() {
            return Err(anyhow!("Hook 不存在于 SSOT: {}", id));
        }

        let hooks_dir = Self::get_project_hooks_dir(project_path)?;

        // 确保父目录存在（支持命名空间）
        let dest = hooks_dir.join(&relative_path);
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::copy(&source, &dest)?;

        log::debug!(
            "Hook {} 已复制到项目 {}",
            id,
            project_path.display()
        );

        Ok(())
    }

    /// 从项目目录删除 Hook
    pub fn remove_from_project(id: &str, project_path: &Path) -> Result<()> {
        let hooks_dir = Self::get_project_hooks_dir(project_path)?;
        let relative_path = Self::id_to_relative_path(id);
        let hook_path = hooks_dir.join(&relative_path);

        if hook_path.exists() {
            fs::remove_file(&hook_path)?;
            log::debug!(
                "Hook {} 已从项目 {} 删除",
                id,
                project_path.display()
            );
        }

        Ok(())
    }

    /// 将 ID 转换为相对路径
    ///
    /// - "pre-bash-check" → "pre-bash-check.json"
    /// - "security/pre-bash-check" → "security/pre-bash-check.json"
    pub fn id_to_relative_path(id: &str) -> PathBuf {
        PathBuf::from(format!("{}.json", id))
    }

    /// 将相对路径转换为 ID
    ///
    /// - "pre-bash-check.json" → "pre-bash-check"
    /// - "security/pre-bash-check.json" → "security/pre-bash-check"
    pub fn relative_path_to_id(path: &Path) -> String {
        path.with_extension("")
            .to_string_lossy()
            .replace('\\', "/")
    }

    /// 解析 ID 为 (namespace, filename)
    ///
    /// - "pre-bash-check" → ("", "pre-bash-check")
    /// - "security/pre-bash-check" → ("security", "pre-bash-check")
    /// - "a/b/c" → ("a/b", "c")
    pub fn parse_id(id: &str) -> (String, String) {
        if let Some(pos) = id.rfind('/') {
            (id[..pos].to_string(), id[pos + 1..].to_string())
        } else {
            (String::new(), id.to_string())
        }
    }

    // ========== 元数据解析 ==========

    /// 解析 Hook JSON 文件内容
    pub fn parse_hook_metadata(content: &str) -> Result<HookFileMetadata> {
        serde_json::from_str(content).map_err(|e| anyhow!("JSON 解析失败: {}", e))
    }

    /// 计算内容的 SHA256 哈希
    pub fn compute_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    // ========== CRUD 操作 ==========

    /// 获取所有已安装的 Hooks
    pub fn get_all_installed(db: &Arc<Database>) -> Result<Vec<InstalledHook>> {
        let hooks = db.get_all_installed_hooks()?;
        Ok(hooks.into_values().collect())
    }

    /// 获取指定 Hook
    pub fn get_hook(db: &Arc<Database>, id: &str) -> Result<Option<InstalledHook>> {
        db.get_installed_hook(id)
            .map_err(|e| anyhow!("获取 Hook 失败: {}", e))
    }

    /// 安装 Hook
    ///
    /// 流程：
    /// 1. 从 GitHub 下载 Hook 文件
    /// 2. 保存到 SSOT 目录
    /// 3. 解析元数据
    /// 4. 保存到数据库
    /// 5. 同步到当前应用 settings.json
    pub async fn install(
        &self,
        db: &Arc<Database>,
        hook: &DiscoverableHook,
        current_app: &AppType,
    ) -> Result<InstalledHook> {
        // 下载 Hook 内容
        let content = self.download_hook_content(hook).await?;

        // 保存到 SSOT
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(&hook.key);
        let dest_path = ssot_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&dest_path, &content)?;

        // 解析元数据
        let metadata = Self::parse_hook_metadata(&content)?;

        // 从 GitHub 获取 blob SHA（与更新检测使用相同的 hash 算法）
        let file_hash = if let Some(ref source_path) = hook.source_path {
            let github_token = db.get_setting("github_pat").ok().flatten();
            let github_api = GitHubApiService::new(github_token);
            match github_api
                .get_file_blob_sha(
                    &hook.repo_owner,
                    &hook.repo_name,
                    &hook.repo_branch,
                    source_path,
                )
                .await
            {
                Ok((sha, _size)) => {
                    log::debug!("Hook {} 获取 GitHub blob SHA: {}", hook.name, sha);
                    sha
                }
                Err(e) => {
                    log::warn!(
                        "Hook {} 获取 GitHub blob SHA 失败，回退到本地计算: {}",
                        hook.name,
                        e
                    );
                    Self::compute_hash(&content)
                }
            }
        } else {
            Self::compute_hash(&content)
        };

        let (namespace, filename) = Self::parse_id(&hook.key);

        // 创建 InstalledHook 记录
        let installed_hook = InstalledHook {
            id: hook.key.clone(),
            name: metadata.name.unwrap_or_else(|| hook.name.clone()),
            description: metadata.description.or_else(|| hook.description.clone()),
            namespace,
            filename,
            event_type: metadata.event_type.unwrap_or(hook.event_type.clone()),
            rules: if metadata.rules.is_empty() {
                hook.rules.clone()
            } else {
                metadata.rules
            },
            enabled: metadata.enabled,
            priority: metadata.priority,
            repo_owner: Some(hook.repo_owner.clone()),
            repo_name: Some(hook.repo_name.clone()),
            repo_branch: Some(hook.repo_branch.clone()),
            readme_url: hook.readme_url.clone(),
            source_path: hook.source_path.clone(),
            apps: HookApps::only(current_app),
            file_hash: Some(file_hash),
            installed_at: chrono::Utc::now().timestamp(),
            scope: "global".to_string(),
            project_path: None,
        };

        // 保存到数据库
        db.save_hook(&installed_hook)?;

        // 同步到当前应用 settings.json
        Self::sync_to_app(db, current_app)?;

        log::info!(
            "Hook {} 安装成功，已启用 {:?}",
            installed_hook.name,
            current_app
        );

        Ok(installed_hook)
    }

    /// 卸载 Hook
    ///
    /// 流程：
    /// 1. 从所有应用 settings.json 移除
    /// 2. 从 SSOT 删除
    /// 3. 从数据库删除
    pub fn uninstall(db: &Arc<Database>, id: &str) -> Result<()> {
        // 获取 hook 信息
        let hook = db
            .get_installed_hook(id)?
            .ok_or_else(|| anyhow!("Hook not found: {}", id))?;

        // 从 SSOT 删除
        let ssot_dir = Self::get_ssot_dir()?;
        let hook_path = ssot_dir.join(Self::id_to_relative_path(id));
        if hook_path.exists() {
            fs::remove_file(&hook_path)?;
        }

        // 清理空的命名空间目录
        if !hook.namespace.is_empty() {
            let ns_dir = ssot_dir.join(&hook.namespace);
            if ns_dir.exists() {
                if let Ok(entries) = fs::read_dir(&ns_dir) {
                    if entries.count() == 0 {
                        let _ = fs::remove_dir(&ns_dir);
                    }
                }
            }
        }

        // 从数据库删除
        db.delete_hook(id)?;

        // 同步到所有应用
        Self::sync_all_to_apps(db)?;

        log::info!("Hook {} 卸载成功", hook.name);

        Ok(())
    }

    /// 切换 Hook 启用状态
    pub fn toggle_enabled(db: &Arc<Database>, id: &str, enabled: bool) -> Result<()> {
        db.update_hook_enabled(id, enabled)?;

        // 同步到所有应用
        Self::sync_all_to_apps(db)?;

        log::info!("Hook {} 启用状态已更新为 {}", id, enabled);

        Ok(())
    }

    /// 切换应用启用状态
    pub fn toggle_app(db: &Arc<Database>, id: &str, app: &AppType, enabled: bool) -> Result<()> {
        // 获取当前 hook
        let mut hook = db
            .get_installed_hook(id)?
            .ok_or_else(|| anyhow!("Hook not found: {}", id))?;

        // 更新状态
        hook.apps.set_enabled_for(app.as_str(), enabled);

        // 更新数据库
        db.update_hook_apps(id, &hook.apps)?;

        // 同步到该应用
        Self::sync_to_app(db, app)?;

        log::info!(
            "Hook {} 的 {:?} 状态已更新为 {}",
            hook.name,
            app,
            enabled
        );

        Ok(())
    }

    /// 修改安装范围
    ///
    /// 将资源从一个范围迁移到另一个范围
    pub fn change_scope(
        db: &Arc<Database>,
        id: &str,
        new_scope: &InstallScope,
        _current_app: &AppType,
    ) -> Result<()> {
        // 获取当前 hook
        let hook = db
            .get_installed_hook(id)?
            .ok_or_else(|| anyhow!("Hook not found: {}", id))?;

        let current_scope =
            InstallScope::from_db(&hook.scope, hook.project_path.as_deref());

        // 如果范围相同，无需操作
        if current_scope == *new_scope {
            return Ok(());
        }

        // 更新数据库
        let (scope_str, project_path) = new_scope.to_db();
        db.update_hook_scope(id, scope_str, project_path.as_deref())?;

        // Hook 使用 sync 机制，重新同步所有应用以应用新范围
        Self::sync_all_to_apps(db)?;

        log::info!(
            "Hook {} 范围已从 {} 变更为 {}",
            hook.name,
            current_scope,
            new_scope
        );

        Ok(())
    }

    /// 更新 Hook 优先级
    pub fn update_priority(db: &Arc<Database>, id: &str, priority: i32) -> Result<()> {
        db.update_hook_priority(id, priority)?;

        // 同步到所有应用（优先级影响执行顺序）
        Self::sync_all_to_apps(db)?;

        log::info!("Hook {} 优先级已更新为 {}", id, priority);

        Ok(())
    }

    /// 批量更新优先级（用于拖拽排序）
    ///
    /// ids 按新的优先级顺序排列，优先级从 0 开始递增
    pub fn reorder_hooks(db: &Arc<Database>, ids: Vec<String>) -> Result<()> {
        db.reorder_hooks(&ids)?;

        // 同步到所有应用
        Self::sync_all_to_apps(db)?;

        log::info!("Hooks 优先级已重新排序");

        Ok(())
    }

    /// 创建命名空间
    pub fn create_namespace(namespace: &str) -> Result<()> {
        if namespace.is_empty() {
            return Err(anyhow!("命名空间不能为空"));
        }

        let ssot_dir = Self::get_ssot_dir()?;
        let ns_dir = ssot_dir.join(namespace);
        fs::create_dir_all(&ns_dir)?;

        log::info!("命名空间 {} 创建成功", namespace);

        Ok(())
    }

    /// 删除命名空间（仅当为空时）
    pub fn delete_namespace(db: &Arc<Database>, namespace: &str) -> Result<()> {
        if namespace.is_empty() {
            return Err(anyhow!("不能删除根命名空间"));
        }

        // 检查是否有 Hooks 使用此命名空间
        let hooks = db.get_hooks_by_namespace(namespace)?;
        if !hooks.is_empty() {
            return Err(anyhow!(
                "命名空间 {} 不为空，包含 {} 个 Hooks",
                namespace,
                hooks.len()
            ));
        }

        let ssot_dir = Self::get_ssot_dir()?;
        let ns_dir = ssot_dir.join(namespace);
        if ns_dir.exists() {
            fs::remove_dir(&ns_dir)?;
        }

        log::info!("命名空间 {} 删除成功", namespace);

        Ok(())
    }

    /// 获取所有命名空间
    pub fn get_namespaces(db: &Arc<Database>) -> Result<Vec<HookNamespace>> {
        db.get_hook_namespaces()
            .map_err(|e| anyhow!("获取命名空间失败: {}", e))
    }

    /// 获取 Hook 文件内容
    pub fn get_hook_content(id: &str) -> Result<String> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Hook 不存在: {}", id));
        }

        fs::read_to_string(&path).map_err(|e| anyhow!("读取文件失败: {}", e))
    }

    /// 保存 Hook 文件内容
    pub fn save_hook_content(db: &Arc<Database>, id: &str, content: &str) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Hook 不存在: {}", id));
        }

        // 验证 JSON 格式
        let metadata = Self::parse_hook_metadata(content)?;

        // 写入文件
        fs::write(&path, content)?;

        // 更新数据库中的元数据
        if let Ok(Some(mut hook)) = db.get_installed_hook(id) {
            hook.name = metadata.name.unwrap_or(hook.name);
            hook.description = metadata.description.or(hook.description);
            hook.event_type = metadata.event_type.unwrap_or(hook.event_type);
            hook.rules = if metadata.rules.is_empty() {
                hook.rules
            } else {
                metadata.rules
            };
            hook.enabled = metadata.enabled;
            hook.priority = metadata.priority;
            hook.file_hash = Some(Self::compute_hash(content));

            db.save_hook(&hook)?;
        }

        // 同步到所有应用
        Self::sync_all_to_apps(db)?;

        log::info!("Hook {} 内容已更新", id);

        Ok(())
    }

    /// 在外部编辑器中打开 Hook
    pub fn open_in_editor(id: &str) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Hook 不存在: {}", id));
        }

        #[cfg(target_os = "macos")]
        {
            std::process::Command::new("open")
                .arg("-t")
                .arg(&path)
                .spawn()?;
        }

        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "notepad"])
                .arg(&path)
                .spawn()?;
        }

        #[cfg(target_os = "linux")]
        {
            std::process::Command::new("xdg-open")
                .arg(&path)
                .spawn()?;
        }

        Ok(())
    }

    // ========== 应用配置同步 ==========

    /// 生成应用的 hooks 配置
    ///
    /// 返回格式符合 Claude Code settings.json hooks 字段的 JSON 对象
    pub fn generate_app_hooks_config(
        db: &Arc<Database>,
        app: &AppType,
    ) -> Result<serde_json::Value> {
        let mut config: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

        // 获取所有已启用的 hooks
        let hooks = Self::get_all_installed(db)?;

        // 按事件类型分组
        for hook in hooks {
            // 检查是否为该应用启用
            if !hook.apps.is_enabled_for(app.as_str()) {
                continue;
            }

            // 检查全局启用状态
            if !hook.enabled {
                continue;
            }

            // 获取事件类型的字符串表示
            let event_key = match hook.event_type {
                HookEventType::PreToolUse => "PreToolUse",
                HookEventType::PostToolUse => "PostToolUse",
                HookEventType::PermissionRequest => "PermissionRequest",
                HookEventType::SessionEnd => "SessionEnd",
            };

            // 将每个规则转换为 hooks 配置项
            for rule in &hook.rules {
                let hooks_array: Vec<serde_json::Value> = rule
                    .hooks
                    .iter()
                    .map(|h| serde_json::to_value(h).unwrap_or(serde_json::Value::Null))
                    .collect();

                let entry = serde_json::json!({
                    "matcher": rule.matcher,
                    "hooks": hooks_array
                });

                config
                    .entry(event_key.to_string())
                    .or_default()
                    .push(entry);
            }
        }

        // 按 priority 排序每个事件类型的 hooks
        // 注意：这里需要在插入时就按优先级排序，或者重新设计数据结构
        // 当前简化处理：按数据库返回顺序（已按 priority 排序）

        Ok(serde_json::to_value(config)?)
    }

    /// 同步 hooks 到指定应用的 settings.json
    ///
    /// 采用合并模式：保留用户手动配置的 hooks，添加 CC Switch 管理的 hooks
    pub fn sync_to_app(db: &Arc<Database>, app: &AppType) -> Result<usize> {
        let settings_path = Self::get_app_settings_path(app)?;

        // 生成 CC Switch 管理的 hooks 配置
        let managed_hooks = Self::generate_app_hooks_config(db, app)?;

        // 读取现有配置
        let mut settings: serde_json::Value = if settings_path.exists() {
            let content = fs::read_to_string(&settings_path)?;
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        // 确保 settings 是对象
        if !settings.is_object() {
            settings = serde_json::json!({});
        }

        // 更新 hooks 字段
        // 简化处理：直接覆盖 hooks 字段
        // TODO: 实现真正的合并模式，保留非 CC Switch 管理的 hooks
        settings["hooks"] = managed_hooks;

        // 确保父目录存在
        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // 写入配置（格式化输出）
        let content = serde_json::to_string_pretty(&settings)?;
        fs::write(&settings_path, content)?;

        // 统计同步的 hooks 数量
        let count = settings["hooks"]
            .as_object()
            .map(|obj| obj.values().filter_map(|v| v.as_array()).map(|a| a.len()).sum())
            .unwrap_or(0);

        log::info!("已同步 {} 个 hooks 到 {:?}", count, app);

        Ok(count)
    }

    /// 同步 hooks 到所有应用
    pub fn sync_all_to_apps(db: &Arc<Database>) -> Result<usize> {
        let mut total = 0;

        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            match Self::sync_to_app(db, &app) {
                Ok(count) => total += count,
                Err(e) => log::warn!("同步 hooks 到 {:?} 失败: {}", app, e),
            }
        }

        Ok(total)
    }

    // ========== 扫描未管理 Hooks ==========

    /// 扫描未管理的 Hooks
    ///
    /// 从各应用 settings.json 中扫描，找出未被 CC Switch 管理的 hooks
    pub fn scan_unmanaged(db: &Arc<Database>) -> Result<Vec<UnmanagedHook>> {
        let managed_hooks = db.get_all_installed_hooks()?;
        let mut unmanaged: Vec<UnmanagedHook> = Vec::new();

        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            let settings_path = match Self::get_app_settings_path(&app) {
                Ok(p) => p,
                Err(_) => continue,
            };

            if !settings_path.exists() {
                continue;
            }

            let content = match fs::read_to_string(&settings_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let settings: serde_json::Value = match serde_json::from_str(&content) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // 解析 hooks 字段
            if let Some(hooks_obj) = settings.get("hooks").and_then(|h| h.as_object()) {
                for (event_type_str, rules_array) in hooks_obj {
                    if let Some(rules) = rules_array.as_array() {
                        for rule in rules.iter() {
                            // 检查是否已被管理（简单检查，可能需要更复杂的逻辑）
                            if managed_hooks.values().any(|h| {
                                let event_key = match h.event_type {
                                    HookEventType::PreToolUse => "PreToolUse",
                                    HookEventType::PostToolUse => "PostToolUse",
                                    HookEventType::PermissionRequest => "PermissionRequest",
                                    HookEventType::SessionEnd => "SessionEnd",
                                };
                                event_key == event_type_str
                                    && h.rules.iter().any(|r| {
                                        rule.get("matcher")
                                            .and_then(|m| m.as_str())
                                            .map(|m| m == r.matcher)
                                            .unwrap_or(false)
                                    })
                            }) {
                                continue;
                            }

                            // 解析事件类型
                            let event_type = match event_type_str.as_str() {
                                "PreToolUse" => HookEventType::PreToolUse,
                                "PostToolUse" => HookEventType::PostToolUse,
                                "PermissionRequest" => HookEventType::PermissionRequest,
                                "SessionEnd" => HookEventType::SessionEnd,
                                _ => continue,
                            };

                            // 解析规则
                            let matcher = rule
                                .get("matcher")
                                .and_then(|m| m.as_str())
                                .unwrap_or("")
                                .to_string();

                            let hooks_value = rule.get("hooks").cloned().unwrap_or(serde_json::json!([]));
                            let parsed_hooks: Vec<crate::app_config::HookType> =
                                serde_json::from_value(hooks_value).unwrap_or_default();

                            // UnmanagedHook 是扁平化结构，每个 hook 创建一个
                            for (hook_idx, hook_type) in parsed_hooks.into_iter().enumerate() {
                                let hook_id = format!(
                                    "unmanaged_{}_{}_{}",
                                    event_type_str.to_lowercase(),
                                    matcher.replace("|", "_").replace("*", "star"),
                                    hook_idx
                                );

                                unmanaged.push(UnmanagedHook {
                                    id: hook_id,
                                    event_type: event_type.clone(),
                                    matcher: matcher.clone(),
                                    hook_type,
                                    found_in: vec![app.as_str().to_string()],
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(unmanaged)
    }

    // ========== 发现功能 ==========

    /// 列出所有可发现的 Hooks（从仓库获取，带缓存支持）
    pub async fn discover_available(
        &self,
        db: &Arc<Database>,
        repos: Vec<CommandRepo>,
        force_refresh: bool,
    ) -> Result<Vec<DiscoverableHook>> {
        use crate::database::CACHE_EXPIRY_SECONDS;

        let mut hooks = Vec::new();

        // 仅使用启用的仓库
        let enabled_repos: Vec<CommandRepo> =
            repos.into_iter().filter(|repo| repo.enabled).collect();

        // 先清理过期缓存
        if let Err(e) = db.cleanup_expired_hook_cache() {
            log::warn!("清理过期 Hook 缓存失败: {}", e);
        }

        // 分离：需要从网络获取的仓库 vs 可以使用缓存的仓库
        let mut repos_to_fetch = Vec::new();
        let mut cached_hooks = Vec::new();

        for repo in &enabled_repos {
            if force_refresh {
                repos_to_fetch.push(repo.clone());
                continue;
            }

            // 尝试从缓存获取
            match db.get_cached_hooks(&repo.owner, &repo.name, &repo.branch) {
                Ok(Some(cache)) => {
                    // 检查缓存是否过期
                    let now = chrono::Utc::now().timestamp();
                    if now - cache.scanned_at < CACHE_EXPIRY_SECONDS {
                        log::debug!(
                            "使用 Hook 缓存: {}/{} ({} 个 hooks)",
                            repo.owner,
                            repo.name,
                            cache.hooks.len()
                        );
                        cached_hooks.extend(cache.hooks);
                    } else {
                        log::debug!("Hook 缓存过期: {}/{}", repo.owner, repo.name);
                        repos_to_fetch.push(repo.clone());
                    }
                }
                Ok(None) => {
                    log::debug!("无 Hook 缓存: {}/{}", repo.owner, repo.name);
                    repos_to_fetch.push(repo.clone());
                }
                Err(e) => {
                    log::warn!("读取 Hook 缓存失败: {}/{}: {}", repo.owner, repo.name, e);
                    repos_to_fetch.push(repo.clone());
                }
            }
        }

        // 从网络获取需要刷新的仓库
        if !repos_to_fetch.is_empty() {
            let db_clone = Arc::clone(db);
            let fetch_tasks = repos_to_fetch
                .iter()
                .map(|repo| self.fetch_repo_hooks_with_cache(repo, &db_clone));

            let results: Vec<Result<Vec<DiscoverableHook>>> =
                futures::future::join_all(fetch_tasks).await;

            for (repo, result) in repos_to_fetch.into_iter().zip(results.into_iter()) {
                match result {
                    Ok(repo_hooks) => hooks.extend(repo_hooks),
                    Err(e) => log::warn!(
                        "获取仓库 {}/{} Hooks 失败: {}",
                        repo.owner,
                        repo.name,
                        e
                    ),
                }
            }
        }

        // 合并缓存的 hooks
        hooks.extend(cached_hooks);

        // 去重并排序
        Self::deduplicate_hooks(&mut hooks);
        hooks.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Ok(hooks)
    }

    /// 从仓库获取 Hooks 列表并更新缓存
    async fn fetch_repo_hooks_with_cache(
        &self,
        repo: &CommandRepo,
        db: &Arc<Database>,
    ) -> Result<Vec<DiscoverableHook>> {
        let hooks = self.fetch_repo_hooks(repo).await?;

        // 保存到缓存
        if let Err(e) = db.save_cached_hooks(&repo.owner, &repo.name, &repo.branch, &hooks) {
            log::warn!(
                "保存 Hook 缓存失败: {}/{}: {}",
                repo.owner,
                repo.name,
                e
            );
        } else {
            log::debug!(
                "已缓存 Hooks: {}/{} ({} 个)",
                repo.owner,
                repo.name,
                hooks.len()
            );
        }

        Ok(hooks)
    }

    /// 从仓库获取 Hooks 列表（不带缓存）
    async fn fetch_repo_hooks(&self, repo: &CommandRepo) -> Result<Vec<DiscoverableHook>> {
        let temp_dir = timeout(
            std::time::Duration::from_secs(60),
            self.download_repo(repo),
        )
        .await
        .map_err(|_| anyhow!("下载仓库超时: {}/{}", repo.owner, repo.name))??;

        let mut hooks = Vec::new();

        // 扫描 hooks 目录
        Self::scan_repo_for_hooks(&temp_dir, &temp_dir, repo, &mut hooks)?;

        let _ = fs::remove_dir_all(&temp_dir);

        Ok(hooks)
    }

    /// 扫描仓库查找所有 hooks 目录中的 hook 文件
    fn scan_repo_for_hooks(
        _current_dir: &Path,
        base_dir: &Path,
        repo: &CommandRepo,
        hooks: &mut Vec<DiscoverableHook>,
    ) -> Result<()> {
        // 查找所有 hooks 目录
        let hooks_dirs = Self::find_hooks_directories(base_dir, 3)?;

        for hooks_dir in hooks_dirs {
            // 计算命名空间
            let namespace = Self::compute_namespace(&hooks_dir, base_dir);

            // 扫描该 hooks 目录内的所有 .json 文件
            Self::scan_hooks_directory(
                &hooks_dir,
                &hooks_dir,
                base_dir,
                &namespace,
                repo,
                hooks,
            )?;
        }

        Ok(())
    }

    /// 浅层扫描查找所有名为 `hooks` 的目录
    fn find_hooks_directories(base_dir: &Path, max_depth: usize) -> Result<Vec<PathBuf>> {
        let mut result = Vec::new();
        Self::find_hooks_directories_recursive(base_dir, 0, max_depth, &mut result)?;
        Ok(result)
    }

    fn find_hooks_directories_recursive(
        current_dir: &Path,
        current_depth: usize,
        max_depth: usize,
        result: &mut Vec<PathBuf>,
    ) -> Result<()> {
        if current_depth > max_depth {
            return Ok(());
        }

        let entries = match fs::read_dir(current_dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏目录
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                if name == "hooks" {
                    result.push(path);
                } else {
                    Self::find_hooks_directories_recursive(
                        &path,
                        current_depth + 1,
                        max_depth,
                        result,
                    )?;
                }
            }
        }

        Ok(())
    }

    /// 计算命名空间
    fn compute_namespace(hooks_dir: &Path, base_dir: &Path) -> String {
        let relative = hooks_dir.strip_prefix(base_dir).unwrap_or(hooks_dir);

        if let Some(parent) = relative.parent() {
            if parent.as_os_str().is_empty() {
                String::new()
            } else {
                parent
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default()
            }
        } else {
            String::new()
        }
    }

    /// 扫描单个 hooks 目录内的 .json 文件
    fn scan_hooks_directory(
        current_dir: &Path,
        hooks_root: &Path,
        base_dir: &Path,
        namespace: &str,
        repo: &CommandRepo,
        hooks: &mut Vec<DiscoverableHook>,
    ) -> Result<()> {
        let entries = match fs::read_dir(current_dir) {
            Ok(e) => e,
            Err(_) => return Ok(()),
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏文件/目录
            if name.starts_with('.') {
                continue;
            }

            // 跳过非 hook 文件
            let skip_files = ["README.json", "LICENSE.json", "CHANGELOG.json"];
            if skip_files.contains(&name.as_str()) {
                continue;
            }

            if path.is_dir() {
                // 递归扫描子目录
                Self::scan_hooks_directory(
                    &path,
                    hooks_root,
                    base_dir,
                    namespace,
                    repo,
                    hooks,
                )?;
            } else if path.extension().map(|e| e == "json").unwrap_or(false) {
                // 计算文件在 hooks 目录内的相对路径
                let relative_in_hooks = path.strip_prefix(hooks_root).unwrap_or(&path);
                let filename_path = relative_in_hooks.with_extension("");
                let filename_str = filename_path.to_string_lossy().replace('\\', "/");

                // 计算完整基础 ID
                let base_id = if namespace.is_empty() {
                    filename_str.clone()
                } else {
                    format!("{}/{}", namespace, filename_str)
                };

                // 计算 source_path
                let source_path = path
                    .strip_prefix(base_dir)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                // 读取文件内容
                let content = fs::read_to_string(&path).unwrap_or_default();

                // 首先尝试 CC Switch 自定义格式（有顶级 event_type 字段）
                let metadata = Self::parse_hook_metadata(&content).unwrap_or_default();

                if let Some(event_type) = metadata.event_type {
                    // CC Switch 格式：单个 hook 预设
                    let (final_namespace, final_filename) = Self::parse_id(&base_id);
                    hooks.push(DiscoverableHook {
                        key: base_id.clone(),
                        name: metadata.name.unwrap_or_else(|| final_filename.clone()),
                        description: metadata.description,
                        namespace: final_namespace,
                        filename: final_filename,
                        event_type,
                        rules: metadata.rules,
                        priority: metadata.priority,
                        readme_url: Some(format!(
                            "https://github.com/{}/{}/blob/{}/{}",
                            repo.owner, repo.name, repo.branch, source_path
                        )),
                        repo_owner: repo.owner.clone(),
                        repo_name: repo.name.clone(),
                        repo_branch: repo.branch.clone(),
                        source_path: Some(source_path),
                    });
                } else {
                    // 尝试 Claude Code 官方格式（hooks 对象包含事件类型键）
                    if let Ok(official) =
                        serde_json::from_str::<OfficialHooksFormat>(&content)
                    {
                        let converted = official.to_hook_metadata_list();
                        for (event_type, hook_meta) in converted {
                            // 为每个事件类型创建一个独立的 hook
                            let event_suffix = match event_type {
                                HookEventType::PreToolUse => "pre-tool-use",
                                HookEventType::PostToolUse => "post-tool-use",
                                HookEventType::PermissionRequest => "permission-request",
                                HookEventType::SessionEnd => "session-end",
                            };
                            let id = format!("{}-{}", base_id, event_suffix);
                            let (final_namespace, final_filename) = Self::parse_id(&id);

                            hooks.push(DiscoverableHook {
                                key: id,
                                name: hook_meta
                                    .name
                                    .unwrap_or_else(|| final_filename.clone()),
                                description: hook_meta.description,
                                namespace: final_namespace,
                                filename: final_filename,
                                event_type,
                                rules: hook_meta.rules,
                                priority: hook_meta.priority,
                                readme_url: Some(format!(
                                    "https://github.com/{}/{}/blob/{}/{}",
                                    repo.owner, repo.name, repo.branch, source_path
                                )),
                                repo_owner: repo.owner.clone(),
                                repo_name: repo.name.clone(),
                                repo_branch: repo.branch.clone(),
                                source_path: Some(source_path.clone()),
                            });
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// 下载单个 Hook 内容
    async fn download_hook_content(&self, hook: &DiscoverableHook) -> Result<String> {
        let file_path = hook
            .source_path
            .clone()
            .unwrap_or_else(|| format!("{}.json", hook.key));

        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            hook.repo_owner, hook.repo_name, hook.repo_branch, file_path
        );

        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "下载 Hook 失败: {} ({})",
                hook.key,
                response.status()
            ));
        }

        let content = response.text().await?;
        Ok(content)
    }

    /// 下载仓库到临时目录
    async fn download_repo(&self, repo: &CommandRepo) -> Result<PathBuf> {
        use std::io::Write;

        let temp_dir = std::env::temp_dir().join(format!(
            "cc-switch-hooks-{}-{}-{}",
            repo.owner, repo.name, repo.branch
        ));

        // 清理旧的临时目录
        if temp_dir.exists() {
            fs::remove_dir_all(&temp_dir)?;
        }

        let zip_url = format!(
            "https://github.com/{}/{}/archive/refs/heads/{}.zip",
            repo.owner, repo.name, repo.branch
        );

        let response = self.http_client.get(&zip_url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "下载仓库失败: {}/{} ({})",
                repo.owner,
                repo.name,
                response.status()
            ));
        }

        let bytes = response.bytes().await?;

        // 保存到临时文件
        let zip_path = temp_dir.with_extension("zip");
        let mut file = fs::File::create(&zip_path)?;
        file.write_all(&bytes)?;

        // 解压
        let file = fs::File::open(&zip_path)?;
        let mut archive = zip::ZipArchive::new(file)?;

        fs::create_dir_all(&temp_dir)?;

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let outpath = match file.enclosed_name() {
                Some(path) => {
                    let components: Vec<_> = path.components().collect();
                    if components.len() > 1 {
                        let rest: PathBuf = components[1..].iter().collect();
                        temp_dir.join(rest)
                    } else {
                        continue;
                    }
                }
                None => continue,
            };

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)?;
                    }
                }
                let mut outfile = fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        // 清理 zip 文件
        let _ = fs::remove_file(&zip_path);

        Ok(temp_dir)
    }

    /// 去重 Hooks
    fn deduplicate_hooks(hooks: &mut Vec<DiscoverableHook>) {
        let mut seen = HashSet::new();
        hooks.retain(|hook| {
            if seen.contains(&hook.key) {
                false
            } else {
                seen.insert(hook.key.clone());
                true
            }
        });
    }

    // ========== 仓库管理（共用 command_repos 表）==========

    /// 获取所有仓库
    pub fn get_repos(db: &Arc<Database>) -> Result<Vec<CommandRepo>> {
        db.get_all_command_repos()
            .map_err(|e| anyhow!("获取仓库失败: {}", e))
    }

    /// 添加仓库
    pub fn add_repo(db: &Arc<Database>, repo: &CommandRepo) -> Result<()> {
        db.add_command_repo(repo)
            .map_err(|e| anyhow!("添加仓库失败: {}", e))
    }

    /// 删除仓库
    pub fn remove_repo(db: &Arc<Database>, owner: &str, name: &str) -> Result<()> {
        db.remove_command_repo(owner, name)?;
        Ok(())
    }

    // ========== SSOT 刷新 ==========

    /// 从 SSOT 目录刷新数据库
    ///
    /// 重新解析所有 Hook 文件，更新数据库中的元数据
    /// 返回更新的 hook 数量
    pub fn refresh_from_ssot(db: &Arc<Database>) -> Result<usize> {
        let ssot_dir = Self::get_ssot_dir()?;

        if !ssot_dir.exists() {
            return Ok(0);
        }

        // 扫描 SSOT 目录中的所有 .json 文件
        let ssot_files = Self::scan_ssot_files(&ssot_dir)?;
        let mut updated = 0;

        for (id, path) in ssot_files {
            if let Ok(content) = fs::read_to_string(&path) {
                let metadata = Self::parse_hook_metadata(&content).unwrap_or_default();
                let (namespace, filename) = Self::parse_id(&id);
                let relative = path.strip_prefix(&ssot_dir).unwrap_or(&path);
                let file_hash = Self::compute_hash(&content);

                // 尝试获取现有记录以保留某些字段
                let existing = db.get_installed_hook(&id)?;

                // 确保有事件类型
                let event_type = match metadata.event_type {
                    Some(et) => et,
                    None => {
                        // 从现有记录获取，或跳过
                        if let Some(ref e) = existing {
                            e.event_type.clone()
                        } else {
                            continue;
                        }
                    }
                };

                let hook = InstalledHook {
                    id: id.clone(),
                    name: metadata.name.unwrap_or_else(|| filename.clone()),
                    description: metadata.description,
                    namespace,
                    filename: filename.clone(),
                    event_type,
                    rules: if metadata.rules.is_empty() {
                        existing.as_ref().map(|e| e.rules.clone()).unwrap_or_default()
                    } else {
                        metadata.rules
                    },
                    enabled: metadata.enabled,
                    priority: metadata.priority,
                    repo_owner: existing.as_ref().and_then(|e| e.repo_owner.clone()),
                    repo_name: existing.as_ref().and_then(|e| e.repo_name.clone()),
                    repo_branch: existing.as_ref().and_then(|e| e.repo_branch.clone()),
                    readme_url: existing.as_ref().and_then(|e| e.readme_url.clone()),
                    source_path: Some(relative.to_string_lossy().to_string()),
                    apps: existing.map(|e| e.apps).unwrap_or_default(),
                    file_hash: Some(file_hash),
                    installed_at: chrono::Utc::now().timestamp(),
                    scope: "global".to_string(),
                    project_path: None,
                };

                db.save_hook(&hook)
                    .map_err(|e| anyhow!("保存 hook 失败: {}", e))?;
                updated += 1;
            }
        }

        // 同步到所有应用
        Self::sync_all_to_apps(db)?;

        Ok(updated)
    }

    /// 扫描 SSOT 目录中的所有 .json 文件
    fn scan_ssot_files(ssot_dir: &Path) -> Result<HashMap<String, PathBuf>> {
        let mut files = HashMap::new();
        Self::scan_dir_recursive(ssot_dir, ssot_dir, &mut files)?;
        Ok(files)
    }

    /// 递归扫描目录
    fn scan_dir_recursive(
        current: &Path,
        base: &Path,
        files: &mut HashMap<String, PathBuf>,
    ) -> Result<()> {
        if !current.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(current)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                Self::scan_dir_recursive(&path, base, files)?;
            } else if path.extension().map(|e| e == "json").unwrap_or(false) {
                let relative = path.strip_prefix(base).unwrap_or(&path);
                let id = Self::relative_path_to_id(relative);
                files.insert(id, path);
            }
        }

        Ok(())
    }
}

/// 检查应用是否支持 Hooks 功能
pub fn check_app_hooks_support(app: &AppType) -> bool {
    // Claude Code 支持 hooks
    // Codex 和 Gemini 需要确认
    match app {
        AppType::Claude => true,
        AppType::Codex => false, // TODO: 确认 Codex CLI 是否支持
        AppType::Gemini => false, // TODO: 确认 Gemini CLI 是否支持
    }
}
