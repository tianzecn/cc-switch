//! Commands 服务层
//!
//! v3.11.0+ 统一管理架构：
//! - SSOT（单一事实源）：`~/.cc-switch/commands/`
//! - 安装时下载到 SSOT，按需同步到各应用目录
//! - 数据库存储安装记录和启用状态
//! - 支持命名空间组织（如 sc/agent, zcf/feat）

use anyhow::{anyhow, Context, Result};
use reqwest::Client;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::time::timeout;

use crate::app_config::{
    AppType, CommandApps, CommandNamespace, CommandRepo, DiscoverableCommand, InstalledCommand,
    UnmanagedCommand,
};
use crate::config::get_app_config_dir;
use crate::database::Database;

// ========== 数据结构 ==========

/// Command 元数据（从 YAML frontmatter 解析）
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CommandMetadata {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    #[serde(default)]
    pub allowed_tools: Option<Vec<String>>,
    #[serde(default)]
    pub mcp_servers: Option<Vec<String>>,
    #[serde(default)]
    pub personas: Option<Vec<String>>,
}

/// 默认仓库配置
pub fn default_command_repos() -> Vec<CommandRepo> {
    vec![
        // 可以添加默认的 Commands 仓库
        // CommandRepo {
        //     owner: "anthropics".to_string(),
        //     name: "claude-commands".to_string(),
        //     branch: "main".to_string(),
        //     enabled: true,
        // },
    ]
}

// ========== CommandService ==========

pub struct CommandService {
    http_client: Client,
}

impl Default for CommandService {
    fn default() -> Self {
        Self::new()
    }
}

impl CommandService {
    pub fn new() -> Self {
        Self {
            http_client: Client::builder()
                .user_agent("cc-switch")
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    // ========== 路径管理 ==========

    /// 获取 SSOT 目录（~/.cc-switch/commands/）
    pub fn get_ssot_dir() -> Result<PathBuf> {
        let dir = get_app_config_dir().join("commands");
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// 获取应用的 commands 目录
    pub fn get_app_commands_dir(app: &AppType) -> Result<PathBuf> {
        // 目录覆盖：优先使用用户在 settings.json 中配置的 override 目录
        match app {
            AppType::Claude => {
                if let Some(custom) = crate::settings::get_claude_override_dir() {
                    return Ok(custom.join("commands"));
                }
            }
            AppType::Codex => {
                if let Some(custom) = crate::settings::get_codex_override_dir() {
                    return Ok(custom.join("commands"));
                }
            }
            AppType::Gemini => {
                if let Some(custom) = crate::settings::get_gemini_override_dir() {
                    return Ok(custom.join("commands"));
                }
            }
        }

        // 默认路径
        let home = dirs::home_dir().context("无法获取用户主目录")?;

        Ok(match app {
            AppType::Claude => home.join(".claude").join("commands"),
            AppType::Codex => home.join(".codex").join("commands"),
            AppType::Gemini => home.join(".gemini").join("commands"),
        })
    }

    /// 从 ID 获取相对路径（包含命名空间）
    ///
    /// - "commit" -> "commit.md"
    /// - "sc/agent" -> "sc/agent.md"
    pub fn id_to_relative_path(id: &str) -> PathBuf {
        PathBuf::from(format!("{}.md", id))
    }

    /// 从相对路径获取 ID
    ///
    /// - "commit.md" -> "commit"
    /// - "sc/agent.md" -> "sc/agent"
    pub fn relative_path_to_id(path: &Path) -> String {
        path.with_extension("")
            .to_string_lossy()
            .replace('\\', "/")
    }

    /// 从 ID 解析命名空间和文件名
    ///
    /// - "commit" -> ("", "commit")
    /// - "sc/agent" -> ("sc", "agent")
    pub fn parse_id(id: &str) -> (String, String) {
        if let Some(pos) = id.rfind('/') {
            (id[..pos].to_string(), id[pos + 1..].to_string())
        } else {
            (String::new(), id.to_string())
        }
    }

    // ========== 统一管理方法 ==========

    /// 获取所有已安装的 Commands
    pub fn get_all_installed(db: &Arc<Database>) -> Result<Vec<InstalledCommand>> {
        let commands = db.get_all_installed_commands()?;
        Ok(commands.into_values().collect())
    }

    /// 获取所有命名空间
    pub fn get_namespaces(db: &Arc<Database>) -> Result<Vec<CommandNamespace>> {
        db.get_command_namespaces()
            .map_err(|e| anyhow!("获取命名空间失败: {}", e))
    }

    /// 安装 Command
    ///
    /// 流程：
    /// 1. 下载到 SSOT 目录
    /// 2. 解析元数据
    /// 3. 保存到数据库
    /// 4. 同步到启用的应用目录
    pub async fn install(
        &self,
        db: &Arc<Database>,
        command: &DiscoverableCommand,
        current_app: &AppType,
    ) -> Result<InstalledCommand> {
        let ssot_dir = Self::get_ssot_dir()?;

        // 计算目标路径
        let relative_path = Self::id_to_relative_path(&command.key);
        let dest = ssot_dir.join(&relative_path);

        // 确保父目录存在（命名空间目录）
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        // 如果已存在则跳过下载
        if !dest.exists() {
            // 下载文件
            let content = self.download_command_content(command).await?;
            fs::write(&dest, &content)?;
        }

        // 读取并解析文件
        let content = fs::read_to_string(&dest)?;
        let metadata = Self::parse_command_metadata(&content)?;
        let file_hash = Self::compute_hash(&content);

        let (namespace, filename) = Self::parse_id(&command.key);

        // 创建 InstalledCommand 记录
        let installed_command = InstalledCommand {
            id: command.key.clone(),
            name: metadata.name.unwrap_or_else(|| command.name.clone()),
            description: metadata.description.or_else(|| {
                if command.description.is_empty() {
                    None
                } else {
                    Some(command.description.clone())
                }
            }),
            namespace,
            filename,
            category: metadata.category.or(command.category.clone()),
            allowed_tools: metadata.allowed_tools,
            mcp_servers: metadata.mcp_servers,
            personas: metadata.personas,
            extra_metadata: None,
            repo_owner: Some(command.repo_owner.clone()),
            repo_name: Some(command.repo_name.clone()),
            repo_branch: Some(command.repo_branch.clone()),
            readme_url: command.readme_url.clone(),
            apps: CommandApps::only(current_app),
            file_hash: Some(file_hash),
            installed_at: chrono::Utc::now().timestamp(),
        };

        // 保存到数据库
        db.save_command(&installed_command)?;

        // 同步到当前应用目录
        Self::copy_to_app(&command.key, current_app)?;

        log::info!(
            "Command {} 安装成功，已启用 {:?}",
            installed_command.name,
            current_app
        );

        Ok(installed_command)
    }

    /// 卸载 Command
    ///
    /// 流程：
    /// 1. 从所有应用目录删除
    /// 2. 从 SSOT 删除
    /// 3. 从数据库删除
    pub fn uninstall(db: &Arc<Database>, id: &str) -> Result<()> {
        // 获取 command 信息
        let command = db
            .get_installed_command(id)?
            .ok_or_else(|| anyhow!("Command not found: {}", id))?;

        // 从所有应用目录删除
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            let _ = Self::remove_from_app(id, &app);
        }

        // 从 SSOT 删除
        let ssot_dir = Self::get_ssot_dir()?;
        let command_path = ssot_dir.join(Self::id_to_relative_path(id));
        if command_path.exists() {
            fs::remove_file(&command_path)?;
        }

        // 清理空的命名空间目录
        if !command.namespace.is_empty() {
            let ns_dir = ssot_dir.join(&command.namespace);
            if ns_dir.exists() {
                if let Ok(entries) = fs::read_dir(&ns_dir) {
                    if entries.count() == 0 {
                        let _ = fs::remove_dir(&ns_dir);
                    }
                }
            }
        }

        // 从数据库删除
        db.delete_command(id)?;

        log::info!("Command {} 卸载成功", command.name);

        Ok(())
    }

    /// 切换应用启用状态
    ///
    /// 启用：复制到应用目录
    /// 禁用：从应用目录删除
    pub fn toggle_app(db: &Arc<Database>, id: &str, app: &AppType, enabled: bool) -> Result<()> {
        // 获取当前 command
        let mut command = db
            .get_installed_command(id)?
            .ok_or_else(|| anyhow!("Command not found: {}", id))?;

        // 更新状态
        command.apps.set_enabled_for(app, enabled);

        // 同步文件
        if enabled {
            Self::copy_to_app(id, app)?;
        } else {
            Self::remove_from_app(id, app)?;
        }

        // 更新数据库
        db.update_command_apps(id, &command.apps)?;

        log::info!(
            "Command {} 的 {:?} 状态已更新为 {}",
            command.name,
            app,
            enabled
        );

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

        // 同时在各应用目录创建
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            if let Ok(app_dir) = Self::get_app_commands_dir(&app) {
                let app_ns_dir = app_dir.join(namespace);
                let _ = fs::create_dir_all(&app_ns_dir);
            }
        }

        log::info!("命名空间 {} 创建成功", namespace);

        Ok(())
    }

    /// 删除命名空间（仅当为空时）
    pub fn delete_namespace(db: &Arc<Database>, namespace: &str) -> Result<()> {
        if namespace.is_empty() {
            return Err(anyhow!("不能删除根命名空间"));
        }

        // 检查是否有 Commands 使用此命名空间
        let commands = db.get_commands_by_namespace(namespace)?;
        if !commands.is_empty() {
            return Err(anyhow!(
                "命名空间 {} 不为空，包含 {} 个 Commands",
                namespace,
                commands.len()
            ));
        }

        let ssot_dir = Self::get_ssot_dir()?;
        let ns_dir = ssot_dir.join(namespace);
        if ns_dir.exists() {
            fs::remove_dir(&ns_dir)?;
        }

        // 同时从各应用目录删除
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            if let Ok(app_dir) = Self::get_app_commands_dir(&app) {
                let app_ns_dir = app_dir.join(namespace);
                let _ = fs::remove_dir(&app_ns_dir);
            }
        }

        log::info!("命名空间 {} 删除成功", namespace);

        Ok(())
    }

    /// 扫描未管理的 Commands
    ///
    /// 扫描各应用目录，找出未被 CC Switch 管理的 Commands
    pub fn scan_unmanaged(db: &Arc<Database>) -> Result<Vec<UnmanagedCommand>> {
        let managed_commands = db.get_all_installed_commands()?;
        let managed_ids: HashSet<String> = managed_commands.keys().cloned().collect();

        let mut unmanaged: HashMap<String, UnmanagedCommand> = HashMap::new();

        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            let app_dir = match Self::get_app_commands_dir(&app) {
                Ok(d) => d,
                Err(_) => continue,
            };

            if !app_dir.exists() {
                continue;
            }

            Self::scan_dir_for_commands(&app_dir, &app_dir, &app, &managed_ids, &mut unmanaged)?;
        }

        Ok(unmanaged.into_values().collect())
    }

    /// 递归扫描目录查找 .md 文件
    fn scan_dir_for_commands(
        current_dir: &Path,
        base_dir: &Path,
        app: &AppType,
        managed_ids: &HashSet<String>,
        unmanaged: &mut HashMap<String, UnmanagedCommand>,
    ) -> Result<()> {
        for entry in fs::read_dir(current_dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏文件/目录
            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                Self::scan_dir_for_commands(&path, base_dir, app, managed_ids, unmanaged)?;
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                let relative = path.strip_prefix(base_dir).unwrap_or(&path);
                let id = Self::relative_path_to_id(relative);

                // 跳过已管理的
                if managed_ids.contains(&id) {
                    continue;
                }

                // 解析元数据
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = Self::parse_command_metadata(&content).unwrap_or_default();

                let (namespace, filename) = Self::parse_id(&id);

                let app_str = match app {
                    AppType::Claude => "claude",
                    AppType::Codex => "codex",
                    AppType::Gemini => "gemini",
                };

                unmanaged
                    .entry(id.clone())
                    .and_modify(|c| c.found_in.push(app_str.to_string()))
                    .or_insert(UnmanagedCommand {
                        id: id.clone(),
                        namespace,
                        filename,
                        name: metadata.name.unwrap_or_else(|| id.clone()),
                        description: metadata.description,
                        found_in: vec![app_str.to_string()],
                    });
            }
        }

        Ok(())
    }

    /// 从应用目录导入 Commands
    ///
    /// 将未管理的 Commands 导入到 CC Switch 统一管理
    pub fn import_from_apps(
        db: &Arc<Database>,
        command_ids: Vec<String>,
    ) -> Result<Vec<InstalledCommand>> {
        let ssot_dir = Self::get_ssot_dir()?;
        let mut imported = Vec::new();

        for id in command_ids {
            let relative_path = Self::id_to_relative_path(&id);
            let mut source_path: Option<PathBuf> = None;
            let mut found_in: Vec<String> = Vec::new();

            // 找到源文件
            for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
                if let Ok(app_dir) = Self::get_app_commands_dir(&app) {
                    let command_path = app_dir.join(&relative_path);
                    if command_path.exists() {
                        if source_path.is_none() {
                            source_path = Some(command_path);
                        }
                        let app_str = match app {
                            AppType::Claude => "claude",
                            AppType::Codex => "codex",
                            AppType::Gemini => "gemini",
                        };
                        found_in.push(app_str.to_string());
                    }
                }
            }

            let source = match source_path {
                Some(p) => p,
                None => continue,
            };

            // 复制到 SSOT
            let dest = ssot_dir.join(&relative_path);
            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent)?;
            }
            if !dest.exists() {
                fs::copy(&source, &dest)?;
            }

            // 解析元数据
            let content = fs::read_to_string(&dest)?;
            let metadata = Self::parse_command_metadata(&content)?;
            let file_hash = Self::compute_hash(&content);
            let (namespace, filename) = Self::parse_id(&id);

            // 构建启用状态
            let mut apps = CommandApps::default();
            for app_str in &found_in {
                match app_str.as_str() {
                    "claude" => apps.claude = true,
                    "codex" => apps.codex = true,
                    "gemini" => apps.gemini = true,
                    _ => {}
                }
            }

            // 创建记录
            let command = InstalledCommand {
                id: id.clone(),
                name: metadata.name.unwrap_or_else(|| filename.clone()),
                description: metadata.description,
                namespace,
                filename,
                category: metadata.category,
                allowed_tools: metadata.allowed_tools,
                mcp_servers: metadata.mcp_servers,
                personas: metadata.personas,
                extra_metadata: None,
                repo_owner: None,
                repo_name: None,
                repo_branch: None,
                readme_url: None,
                apps,
                file_hash: Some(file_hash),
                installed_at: chrono::Utc::now().timestamp(),
            };

            // 保存到数据库
            db.save_command(&command)?;
            imported.push(command);
        }

        log::info!("成功导入 {} 个 Commands", imported.len());

        Ok(imported)
    }

    // ========== 文件同步方法 ==========

    /// 复制 Command 到应用目录
    pub fn copy_to_app(id: &str, app: &AppType) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let source = ssot_dir.join(&relative_path);

        if !source.exists() {
            return Err(anyhow!("Command 不存在于 SSOT: {}", id));
        }

        let app_dir = Self::get_app_commands_dir(app)?;
        let dest = app_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::copy(&source, &dest)?;

        log::debug!("Command {} 已复制到 {:?}", id, app);

        Ok(())
    }

    /// 从应用目录删除 Command
    pub fn remove_from_app(id: &str, app: &AppType) -> Result<()> {
        let app_dir = Self::get_app_commands_dir(app)?;
        let relative_path = Self::id_to_relative_path(id);
        let command_path = app_dir.join(&relative_path);

        if command_path.exists() {
            fs::remove_file(&command_path)?;
            log::debug!("Command {} 已从 {:?} 删除", id, app);

            // 清理空的命名空间目录
            if let Some(parent) = command_path.parent() {
                if parent != app_dir {
                    if let Ok(entries) = fs::read_dir(parent) {
                        if entries.count() == 0 {
                            let _ = fs::remove_dir(parent);
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// 同步所有已启用的 Commands 到指定应用
    pub fn sync_to_app(db: &Arc<Database>, app: &AppType) -> Result<()> {
        let commands = db.get_all_installed_commands()?;

        for command in commands.values() {
            if command.apps.is_enabled_for(app) {
                Self::copy_to_app(&command.id, app)?;
            }
        }

        Ok(())
    }

    // ========== 发现功能 ==========

    /// 列出所有可发现的 Commands（从仓库获取）
    pub async fn discover_available(
        &self,
        repos: Vec<CommandRepo>,
    ) -> Result<Vec<DiscoverableCommand>> {
        let mut commands = Vec::new();

        // 仅使用启用的仓库
        let enabled_repos: Vec<CommandRepo> =
            repos.into_iter().filter(|repo| repo.enabled).collect();

        let fetch_tasks = enabled_repos
            .iter()
            .map(|repo| self.fetch_repo_commands(repo));

        let results: Vec<Result<Vec<DiscoverableCommand>>> =
            futures::future::join_all(fetch_tasks).await;

        for (repo, result) in enabled_repos.into_iter().zip(results.into_iter()) {
            match result {
                Ok(repo_commands) => commands.extend(repo_commands),
                Err(e) => log::warn!(
                    "获取仓库 {}/{} Commands 失败: {}",
                    repo.owner,
                    repo.name,
                    e
                ),
            }
        }

        // 去重并排序
        Self::deduplicate_commands(&mut commands);
        commands.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Ok(commands)
    }

    /// 从仓库获取 Commands 列表
    async fn fetch_repo_commands(&self, repo: &CommandRepo) -> Result<Vec<DiscoverableCommand>> {
        let temp_dir = timeout(
            std::time::Duration::from_secs(60),
            self.download_repo(repo),
        )
        .await
        .map_err(|_| anyhow!("下载仓库超时: {}/{}", repo.owner, repo.name))??;

        let mut commands = Vec::new();

        // 扫描根目录和子目录
        Self::scan_repo_for_commands(&temp_dir, &temp_dir, repo, &mut commands)?;

        let _ = fs::remove_dir_all(&temp_dir);

        Ok(commands)
    }

    /// 扫描仓库目录查找 .md 文件
    fn scan_repo_for_commands(
        current_dir: &Path,
        base_dir: &Path,
        repo: &CommandRepo,
        commands: &mut Vec<DiscoverableCommand>,
    ) -> Result<()> {
        for entry in fs::read_dir(current_dir)? {
            let entry = entry?;
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            // 跳过隐藏文件/目录
            if name.starts_with('.') {
                continue;
            }

            // 跳过非 command 文件（如 README.md, LICENSE.md 等）
            let skip_files = ["README.md", "LICENSE.md", "CHANGELOG.md", "CONTRIBUTING.md"];
            if skip_files.contains(&name.as_str()) {
                continue;
            }

            if path.is_dir() {
                Self::scan_repo_for_commands(&path, base_dir, repo, commands)?;
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                let relative = path.strip_prefix(base_dir).unwrap_or(&path);
                let id = Self::relative_path_to_id(relative);

                // 解析元数据
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = Self::parse_command_metadata(&content).unwrap_or_default();

                let (namespace, filename) = Self::parse_id(&id);

                commands.push(DiscoverableCommand {
                    key: id,
                    name: metadata.name.unwrap_or_else(|| filename.clone()),
                    description: metadata.description.unwrap_or_default(),
                    namespace,
                    filename,
                    category: metadata.category,
                    readme_url: Some(format!(
                        "https://github.com/{}/{}/blob/{}/{}",
                        repo.owner,
                        repo.name,
                        repo.branch,
                        relative.display()
                    )),
                    repo_owner: repo.owner.clone(),
                    repo_name: repo.name.clone(),
                    repo_branch: repo.branch.clone(),
                });
            }
        }

        Ok(())
    }

    /// 下载单个 Command 内容
    async fn download_command_content(&self, command: &DiscoverableCommand) -> Result<String> {
        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}.md",
            command.repo_owner, command.repo_name, command.repo_branch, command.key
        );

        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "下载 Command 失败: HTTP {}",
                response.status().as_u16()
            ));
        }

        Ok(response.text().await?)
    }

    /// 下载仓库
    async fn download_repo(&self, repo: &CommandRepo) -> Result<PathBuf> {
        let temp_dir = tempfile::tempdir()?;
        let temp_path = temp_dir.path().to_path_buf();
        let _ = temp_dir.keep();

        let branches = if repo.branch.is_empty() {
            vec!["main", "master"]
        } else {
            vec![repo.branch.as_str(), "main", "master"]
        };

        let mut last_error = None;
        for branch in branches {
            let url = format!(
                "https://github.com/{}/{}/archive/refs/heads/{}.zip",
                repo.owner, repo.name, branch
            );

            match self.download_and_extract(&url, &temp_path).await {
                Ok(_) => {
                    return Ok(temp_path);
                }
                Err(e) => {
                    last_error = Some(e);
                    continue;
                }
            }
        }

        Err(last_error.unwrap_or_else(|| anyhow!("所有分支下载失败")))
    }

    /// 下载并解压 ZIP
    async fn download_and_extract(&self, url: &str, dest: &Path) -> Result<()> {
        let response = self.http_client.get(url).send().await?;
        if !response.status().is_success() {
            return Err(anyhow!("下载失败: HTTP {}", response.status().as_u16()));
        }

        let bytes = response.bytes().await?;
        let cursor = std::io::Cursor::new(bytes);
        let mut archive = zip::ZipArchive::new(cursor)?;

        let root_name = if !archive.is_empty() {
            let first_file = archive.by_index(0)?;
            let name = first_file.name();
            name.split('/').next().unwrap_or("").to_string()
        } else {
            return Err(anyhow!("空的 ZIP 文件"));
        };

        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let file_path = file.name();

            let relative_path =
                if let Some(stripped) = file_path.strip_prefix(&format!("{root_name}/")) {
                    stripped
                } else {
                    continue;
                };

            if relative_path.is_empty() {
                continue;
            }

            let outpath = dest.join(relative_path);

            if file.is_dir() {
                fs::create_dir_all(&outpath)?;
            } else {
                if let Some(parent) = outpath.parent() {
                    fs::create_dir_all(parent)?;
                }
                let mut outfile = fs::File::create(&outpath)?;
                std::io::copy(&mut file, &mut outfile)?;
            }
        }

        Ok(())
    }

    /// 去重 Commands 列表
    fn deduplicate_commands(commands: &mut Vec<DiscoverableCommand>) {
        let mut seen = HashMap::new();
        commands.retain(|cmd| {
            let key = cmd.key.to_lowercase();
            if let std::collections::hash_map::Entry::Vacant(e) = seen.entry(key) {
                e.insert(true);
                true
            } else {
                false
            }
        });
    }

    // ========== 元数据解析 ==========

    /// 解析 Command 文件的 YAML frontmatter
    pub fn parse_command_metadata(content: &str) -> Result<CommandMetadata> {
        let content = content.trim_start_matches('\u{feff}'); // Remove BOM

        let parts: Vec<&str> = content.splitn(3, "---").collect();
        if parts.len() < 3 {
            return Ok(CommandMetadata::default());
        }

        let front_matter = parts[1].trim();
        let meta: CommandMetadata = serde_yaml::from_str(front_matter).unwrap_or_default();

        Ok(meta)
    }

    /// 计算文件内容哈希
    pub fn compute_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    /// 获取 Command 文件内容
    pub fn get_command_content(id: &str) -> Result<String> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Command 不存在: {}", id));
        }

        fs::read_to_string(&path).map_err(|e| anyhow!("读取文件失败: {}", e))
    }

    /// 在外部编辑器中打开 Command
    pub fn open_in_editor(id: &str) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Command 不存在: {}", id));
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

    // ========== 仓库管理 ==========

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
}

// ========== 变更检测与冲突解决 ==========

/// 变更事件类型
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeEventType {
    /// SSOT 文件被修改
    SsotModified,
    /// SSOT 文件被删除
    SsotDeleted,
    /// SSOT 新增文件（未管理）
    SsotAdded,
    /// 应用目录与 SSOT 不一致（冲突）
    AppConflict,
}

/// 变更事件
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeEvent {
    pub id: String,
    pub event_type: ChangeEventType,
    pub app: Option<String>,
    pub details: Option<String>,
}

/// 冲突解决选项
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictResolution {
    /// 保留 SSOT 版本
    KeepSsot,
    /// 保留应用目录版本
    KeepApp,
}

impl CommandService {
    /// 检测所有变更
    ///
    /// 扫描 SSOT 目录和应用目录，检测：
    /// 1. SSOT 文件哈希变化
    /// 2. SSOT 新增/删除文件
    /// 3. 应用目录与 SSOT 的不一致
    pub fn detect_changes(db: &Arc<Database>) -> Result<Vec<ChangeEvent>> {
        let mut events = Vec::new();

        let ssot_dir = Self::get_ssot_dir()?;
        let installed = db.get_all_installed_commands()?;

        // 1. 检测 SSOT 目录中的变更
        let ssot_files = Self::scan_ssot_files(&ssot_dir)?;

        for (id, file_path) in &ssot_files {
            if let Some(command) = installed.get(id) {
                // 已管理的文件：检查哈希变化
                let content = fs::read_to_string(file_path)?;
                let current_hash = Self::compute_hash(&content);

                if let Some(ref stored_hash) = command.file_hash {
                    if &current_hash != stored_hash {
                        events.push(ChangeEvent {
                            id: id.clone(),
                            event_type: ChangeEventType::SsotModified,
                            app: None,
                            details: Some("文件内容已变更".to_string()),
                        });
                    }
                }
            } else {
                // 未管理的文件
                events.push(ChangeEvent {
                    id: id.clone(),
                    event_type: ChangeEventType::SsotAdded,
                    app: None,
                    details: Some("发现未管理的 Command 文件".to_string()),
                });
            }
        }

        // 2. 检测已删除的文件
        for id in installed.keys() {
            if !ssot_files.contains_key(id) {
                events.push(ChangeEvent {
                    id: id.clone(),
                    event_type: ChangeEventType::SsotDeleted,
                    app: None,
                    details: Some("SSOT 文件已被删除".to_string()),
                });
            }
        }

        // 3. 检测应用目录与 SSOT 的冲突
        for command in installed.values() {
            let ssot_path = ssot_dir.join(Self::id_to_relative_path(&command.id));
            if !ssot_path.exists() {
                continue;
            }

            let ssot_content = fs::read_to_string(&ssot_path)?;
            let ssot_hash = Self::compute_hash(&ssot_content);

            for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
                if !command.apps.is_enabled_for(&app) {
                    continue;
                }

                if let Ok(app_dir) = Self::get_app_commands_dir(&app) {
                    let app_path = app_dir.join(Self::id_to_relative_path(&command.id));
                    if app_path.exists() {
                        let app_content = fs::read_to_string(&app_path)?;
                        let app_hash = Self::compute_hash(&app_content);

                        if app_hash != ssot_hash {
                            events.push(ChangeEvent {
                                id: command.id.clone(),
                                event_type: ChangeEventType::AppConflict,
                                app: Some(app.as_str().to_string()),
                                details: Some(format!(
                                    "{} 目录中的文件与 SSOT 不一致",
                                    app.as_str()
                                )),
                            });
                        }
                    }
                }
            }
        }

        Ok(events)
    }

    /// 扫描 SSOT 目录中的所有 .md 文件
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
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                let relative = path.strip_prefix(base).unwrap_or(&path);
                let id = Self::relative_path_to_id(relative);
                files.insert(id, path);
            }
        }

        Ok(())
    }

    /// 解决冲突
    ///
    /// - KeepSsot: 用 SSOT 版本覆盖应用目录
    /// - KeepApp: 用应用目录版本更新 SSOT 和数据库
    pub fn resolve_conflict(
        db: &Arc<Database>,
        id: &str,
        app: &AppType,
        resolution: ConflictResolution,
    ) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let ssot_path = ssot_dir.join(Self::id_to_relative_path(id));

        let app_dir = Self::get_app_commands_dir(app)?;
        let app_path = app_dir.join(Self::id_to_relative_path(id));

        match resolution {
            ConflictResolution::KeepSsot => {
                // 用 SSOT 覆盖应用目录
                if ssot_path.exists() {
                    if let Some(parent) = app_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(&ssot_path, &app_path)?;
                    log::info!("冲突已解决：保留 SSOT 版本，覆盖 {:?} 目录", app);
                }
            }
            ConflictResolution::KeepApp => {
                // 用应用目录版本更新 SSOT
                if app_path.exists() {
                    fs::copy(&app_path, &ssot_path)?;

                    // 更新数据库
                    let content = fs::read_to_string(&ssot_path)?;
                    let metadata = Self::parse_command_metadata(&content)?;
                    let file_hash = Self::compute_hash(&content);

                    if let Some(mut command) = db.get_installed_command(id)? {
                        command.name = metadata.name.unwrap_or(command.name);
                        command.description = metadata.description.or(command.description);
                        command.category = metadata.category.or(command.category);
                        command.allowed_tools = metadata.allowed_tools.or(command.allowed_tools);
                        command.mcp_servers = metadata.mcp_servers.or(command.mcp_servers);
                        command.personas = metadata.personas.or(command.personas);
                        command.file_hash = Some(file_hash);

                        db.save_command(&command)?;
                    }

                    log::info!(
                        "冲突已解决：保留 {:?} 目录版本，更新 SSOT 和数据库",
                        app
                    );
                }
            }
        }

        Ok(())
    }

    /// 刷新 SSOT 变更到数据库
    ///
    /// 重新解析所有已管理的 Command 文件，更新数据库中的元数据和哈希
    pub fn refresh_from_ssot(db: &Arc<Database>) -> Result<usize> {
        let ssot_dir = Self::get_ssot_dir()?;
        let mut updated_count = 0;

        let commands = db.get_all_installed_commands()?;

        for mut command in commands.into_values() {
            let file_path = ssot_dir.join(Self::id_to_relative_path(&command.id));

            if !file_path.exists() {
                // 文件已删除，从数据库移除
                db.delete_command(&command.id)?;
                log::info!("Command {} 已从数据库移除（文件不存在）", command.id);
                continue;
            }

            let content = fs::read_to_string(&file_path)?;
            let current_hash = Self::compute_hash(&content);

            // 检查是否需要更新
            let needs_update = command.file_hash.as_ref() != Some(&current_hash);

            if needs_update {
                let metadata = Self::parse_command_metadata(&content)?;

                command.name = metadata.name.unwrap_or(command.filename.clone());
                command.description = metadata.description;
                command.category = metadata.category;
                command.allowed_tools = metadata.allowed_tools;
                command.mcp_servers = metadata.mcp_servers;
                command.personas = metadata.personas;
                command.file_hash = Some(current_hash);

                db.save_command(&command)?;
                updated_count += 1;

                log::info!("Command {} 已从 SSOT 刷新", command.id);
            }
        }

        Ok(updated_count)
    }

    /// 同步所有 Commands 到已启用的应用目录
    ///
    /// 确保所有已启用的应用目录与 SSOT 保持一致
    pub fn sync_all_to_apps(db: &Arc<Database>) -> Result<usize> {
        let commands = db.get_all_installed_commands()?;
        let mut synced_count = 0;

        for command in commands.values() {
            for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
                if command.apps.is_enabled_for(&app) {
                    if Self::copy_to_app(&command.id, &app).is_ok() {
                        synced_count += 1;
                    }
                }
            }
        }

        log::info!("已同步 {} 个 Command 文件到应用目录", synced_count);
        Ok(synced_count)
    }
}

// ========== 检测应用是否支持 Commands ==========

/// 检测应用是否支持 Commands 功能
pub fn check_app_commands_support(app: &AppType) -> bool {
    // 目前只有 Claude Code 确定支持 Commands
    // Codex 和 Gemini 需要后续确认
    match app {
        AppType::Claude => true,
        AppType::Codex => false, // TODO: 确认 Codex CLI 是否支持
        AppType::Gemini => false, // TODO: 确认 Gemini CLI 是否支持
    }
}
