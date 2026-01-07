//! Agent 服务层
//!
//! 提供 Agent 管理的核心业务逻辑：
//! - 安装/卸载 Agents
//! - 同步到各应用目录
//! - 发现可用 Agents（GitHub 仓库扫描）
//! - 命名空间管理
//!
//! ## 目录结构
//!
//! - SSOT: `~/.cc-switch/agents/`
//! - Claude: `~/.claude/agents/`
//! - Codex: `~/.codex/agents/`
//! - Gemini: `~/.gemini/agents/`
//!
//! ## Agent 文件格式
//!
//! ```yaml
//! ---
//! name: agent-name
//! description: Agent description
//! model: sonnet
//! tools:
//!   - Read
//!   - Write
//!   - Bash
//! ---
//!
//! Agent prompt content...
//! ```

use crate::app_config::{
    AgentApps, AppType, CommandRepo, DiscoverableAgent, InstalledAgent, UnmanagedAgent,
};
use crate::config::get_app_config_dir;
use crate::database::Database;
use anyhow::{anyhow, Result};
use regex::Regex;
use reqwest::Client;
use serde::de::Deserializer;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::time::timeout;

/// Agent 元数据（从 YAML frontmatter 解析）
#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AgentMetadata {
    /// 显示名称
    pub name: Option<String>,
    /// 描述
    pub description: Option<String>,
    /// 模型设置（sonnet, opus, haiku 等）
    pub model: Option<String>,
    /// 工具列表（支持数组或逗号分隔字符串）
    #[serde(default, deserialize_with = "deserialize_tools_flexible")]
    pub tools: Option<Vec<String>>,
}

/// 灵活反序列化 tools 字段
/// 支持两种格式：
/// 1. YAML 数组: `tools: [Read, Write]` 或列表形式
/// 2. 逗号分隔字符串: `tools: "Read, Write, Edit, Bash"`
fn deserialize_tools_flexible<'de, D>(deserializer: D) -> std::result::Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum ToolsValue {
        Array(Vec<String>),
        String(String),
    }

    let value: Option<ToolsValue> = Option::deserialize(deserializer)?;

    match value {
        Some(ToolsValue::Array(arr)) => Ok(Some(arr)),
        Some(ToolsValue::String(s)) => {
            if s.trim().is_empty() {
                Ok(None)
            } else {
                // 按逗号分隔并去除空白
                let tools: Vec<String> = s
                    .split(',')
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .collect();
                if tools.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(tools))
                }
            }
        }
        None => Ok(None),
    }
}

/// Agent 服务
pub struct AgentService {
    http_client: Client,
}

impl Default for AgentService {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentService {
    /// 创建新的 AgentService 实例
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
    /// 返回 `~/.cc-switch/agents/`
    pub fn get_ssot_dir() -> Result<PathBuf> {
        let dir = get_app_config_dir().join("agents");
        if !dir.exists() {
            fs::create_dir_all(&dir)?;
        }
        Ok(dir)
    }

    /// 获取指定应用的 agents 目录
    ///
    /// - Claude: `~/.claude/agents/`
    /// - Codex: `~/.codex/agents/`
    /// - Gemini: `~/.gemini/agents/`
    pub fn get_app_agents_dir(app: &AppType) -> Result<PathBuf> {
        let home = dirs::home_dir().ok_or_else(|| anyhow!("无法获取用户主目录"))?;

        let dir = match app {
            AppType::Claude => home.join(".claude").join("agents"),
            AppType::Codex => home.join(".codex").join("agents"),
            AppType::Gemini => home.join(".gemini").join("agents"),
        };

        Ok(dir)
    }

    /// 将 ID 转换为相对路径
    ///
    /// - "debugger" → "debugger.md"
    /// - "development/code-reviewer" → "development/code-reviewer.md"
    pub fn id_to_relative_path(id: &str) -> PathBuf {
        PathBuf::from(format!("{}.md", id))
    }

    /// 将相对路径转换为 ID
    ///
    /// - "debugger.md" → "debugger"
    /// - "development/code-reviewer.md" → "development/code-reviewer"
    pub fn relative_path_to_id(path: &Path) -> String {
        path.with_extension("")
            .to_string_lossy()
            .replace('\\', "/")
    }

    /// 解析 ID 为 (namespace, filename)
    ///
    /// - "debugger" → ("", "debugger")
    /// - "development/code-reviewer" → ("development", "code-reviewer")
    /// - "a/b/c" → ("a/b", "c")
    pub fn parse_id(id: &str) -> (String, String) {
        if let Some(pos) = id.rfind('/') {
            (id[..pos].to_string(), id[pos + 1..].to_string())
        } else {
            (String::new(), id.to_string())
        }
    }

    // ========== 元数据解析 ==========

    /// 解析 Agent 文件的 YAML frontmatter
    ///
    /// 支持格式：
    /// ```yaml
    /// ---
    /// name: Agent Name
    /// description: Agent description
    /// model: sonnet
    /// tools:
    ///   - Read
    ///   - Write
    /// ---
    /// ```
    ///
    /// 如果 YAML 解析失败（例如 description 中包含未转义的冒号），
    /// 会尝试使用正则表达式进行容错解析。
    pub fn parse_agent_metadata(content: &str) -> Result<AgentMetadata> {
        // 检查是否以 YAML frontmatter 开始
        if !content.starts_with("---") {
            return Ok(AgentMetadata::default());
        }

        // 查找结束标记
        let rest = &content[3..];
        if let Some(end_pos) = rest.find("\n---") {
            let yaml_content = &rest[..end_pos].trim();

            // 首先尝试标准 YAML 解析
            match serde_yaml::from_str::<AgentMetadata>(yaml_content) {
                Ok(metadata) => Ok(metadata),
                Err(_e) => {
                    // YAML 解析失败，尝试容错解析
                    // 这通常发生在 description 字段包含未转义的冒号时
                    Ok(Self::parse_yaml_fallback(yaml_content))
                }
            }
        } else {
            Ok(AgentMetadata::default())
        }
    }

    /// 容错解析 YAML frontmatter
    ///
    /// 当标准 YAML 解析失败时，使用正则表达式提取关键字段。
    /// 这可以处理 description 字段包含未转义冒号等情况。
    fn parse_yaml_fallback(yaml_content: &str) -> AgentMetadata {
        let mut metadata = AgentMetadata::default();

        // 提取 name 字段（简单值，通常不包含特殊字符）
        if let Some(caps) = Regex::new(r"(?m)^name:\s*(.+?)$")
            .ok()
            .and_then(|re| re.captures(yaml_content))
        {
            metadata.name = Some(caps[1].trim().to_string());
        }

        // 提取 model 字段（简单值）
        if let Some(caps) = Regex::new(r"(?m)^model:\s*(\w+)")
            .ok()
            .and_then(|re| re.captures(yaml_content))
        {
            metadata.model = Some(caps[1].trim().to_string());
        }

        // 提取 color 字段（简单值）
        // color 不在 AgentMetadata 中，但为了完整性保留注释

        // 提取 description 字段
        // description 可能包含冒号，所以我们需要特殊处理
        // 策略：找到 description: 后，一直读到下一个已知字段或文档结束
        if let Some(desc_start) = yaml_content.find("description:") {
            let after_key = &yaml_content[desc_start + 12..]; // "description:" 长度为 12

            // 找到下一个顶级字段的位置
            let next_field_patterns = ["name:", "model:", "tools:", "color:"];
            let mut end_pos = after_key.len();

            for pattern in next_field_patterns {
                if let Some(pos) = Regex::new(&format!(r"(?m)^{}", regex::escape(pattern)))
                    .ok()
                    .and_then(|re| re.find(after_key))
                {
                    if pos.start() < end_pos {
                        end_pos = pos.start();
                    }
                }
            }

            let desc_value = after_key[..end_pos].trim();
            if !desc_value.is_empty() {
                // 清理可能的换行符和多余空白
                let cleaned = desc_value
                    .lines()
                    .map(|l| l.trim())
                    .collect::<Vec<_>>()
                    .join(" ")
                    .trim()
                    .to_string();
                metadata.description = Some(cleaned);
            }
        }

        // 提取 tools 字段
        // 支持两种格式：
        // 1. tools: Tool1, Tool2, Tool3
        // 2. tools:\n  - Tool1\n  - Tool2
        if let Some(tools_start) = yaml_content.find("tools:") {
            let after_key = &yaml_content[tools_start + 6..]; // "tools:" 长度为 6

            // 检查是内联格式还是列表格式
            let first_line = after_key.lines().next().unwrap_or("");

            if first_line.trim().is_empty() {
                // 列表格式：tools:\n  - Tool1\n  - Tool2
                let mut tools = Vec::new();
                for line in after_key.lines().skip(1) {
                    let trimmed = line.trim();
                    if trimmed.starts_with('-') {
                        let tool = trimmed[1..].trim();
                        if !tool.is_empty() {
                            tools.push(tool.to_string());
                        }
                    } else if !trimmed.is_empty() && !trimmed.starts_with('#') {
                        // 遇到非列表项且非空行，结束解析
                        break;
                    }
                }
                if !tools.is_empty() {
                    metadata.tools = Some(tools);
                }
            } else {
                // 内联格式：tools: Tool1, Tool2, Tool3
                let tools: Vec<String> = first_line
                    .split(',')
                    .map(|t| t.trim().to_string())
                    .filter(|t| !t.is_empty())
                    .collect();
                if !tools.is_empty() {
                    metadata.tools = Some(tools);
                }
            }
        }

        metadata
    }

    /// 计算内容的 SHA256 哈希
    pub fn compute_hash(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    // ========== CRUD 操作 ==========

    /// 获取所有已安装的 Agents
    pub fn get_all_installed(db: &Arc<Database>) -> Result<Vec<InstalledAgent>> {
        let agents = db.get_all_installed_agents()?;
        Ok(agents.into_values().collect())
    }

    /// 安装 Agent
    ///
    /// 流程：
    /// 1. 从 GitHub 下载 Agent 文件
    /// 2. 保存到 SSOT 目录
    /// 3. 解析元数据
    /// 4. 保存到数据库
    /// 5. 同步到当前应用目录
    pub async fn install(
        &self,
        db: &Arc<Database>,
        agent: &DiscoverableAgent,
        current_app: &AppType,
    ) -> Result<InstalledAgent> {
        // 下载 Agent 内容
        let content = self.download_agent_content(agent).await?;

        // 保存到 SSOT
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(&agent.key);
        let dest_path = ssot_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = dest_path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(&dest_path, &content)?;

        // 解析元数据
        let metadata = Self::parse_agent_metadata(&content)?;
        let file_hash = Self::compute_hash(&content);
        let (namespace, filename) = Self::parse_id(&agent.key);

        // 创建 InstalledAgent 记录
        let installed_agent = InstalledAgent {
            id: agent.key.clone(),
            name: metadata.name.unwrap_or_else(|| agent.name.clone()),
            description: metadata.description.or_else(|| {
                if agent.description.is_empty() {
                    None
                } else {
                    Some(agent.description.clone())
                }
            }),
            namespace,
            filename,
            model: metadata.model.or(agent.model.clone()),
            tools: metadata.tools.or(agent.tools.clone()),
            extra_metadata: None,
            repo_owner: Some(agent.repo_owner.clone()),
            repo_name: Some(agent.repo_name.clone()),
            repo_branch: Some(agent.repo_branch.clone()),
            readme_url: agent.readme_url.clone(),
            source_path: agent.source_path.clone(),
            apps: AgentApps::only(current_app),
            file_hash: Some(file_hash),
            installed_at: chrono::Utc::now().timestamp(),
        };

        // 保存到数据库
        db.save_agent(&installed_agent)?;

        // 同步到当前应用目录
        Self::copy_to_app(&agent.key, current_app)?;

        log::info!(
            "Agent {} 安装成功，已启用 {:?}",
            installed_agent.name,
            current_app
        );

        Ok(installed_agent)
    }

    /// 卸载 Agent
    ///
    /// 流程：
    /// 1. 从所有应用目录删除
    /// 2. 从 SSOT 删除
    /// 3. 从数据库删除
    pub fn uninstall(db: &Arc<Database>, id: &str) -> Result<()> {
        // 获取 agent 信息
        let agent = db
            .get_installed_agent(id)?
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;

        // 从所有应用目录删除
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            let _ = Self::remove_from_app(id, &app);
        }

        // 从 SSOT 删除
        let ssot_dir = Self::get_ssot_dir()?;
        let agent_path = ssot_dir.join(Self::id_to_relative_path(id));
        if agent_path.exists() {
            fs::remove_file(&agent_path)?;
        }

        // 清理空的命名空间目录
        if !agent.namespace.is_empty() {
            let ns_dir = ssot_dir.join(&agent.namespace);
            if ns_dir.exists() {
                if let Ok(entries) = fs::read_dir(&ns_dir) {
                    if entries.count() == 0 {
                        let _ = fs::remove_dir(&ns_dir);
                    }
                }
            }
        }

        // 从数据库删除
        db.delete_agent(id)?;

        log::info!("Agent {} 卸载成功", agent.name);

        Ok(())
    }

    /// 切换应用启用状态
    ///
    /// 启用：复制到应用目录
    /// 禁用：从应用目录删除
    pub fn toggle_app(db: &Arc<Database>, id: &str, app: &AppType, enabled: bool) -> Result<()> {
        // 获取当前 agent
        let mut agent = db
            .get_installed_agent(id)?
            .ok_or_else(|| anyhow!("Agent not found: {}", id))?;

        // 更新状态
        agent.apps.set_enabled_for(app.as_str(), enabled);

        // 同步文件
        if enabled {
            Self::copy_to_app(id, app)?;
        } else {
            Self::remove_from_app(id, app)?;
        }

        // 更新数据库
        db.update_agent_apps(id, &agent.apps)?;

        log::info!(
            "Agent {} 的 {:?} 状态已更新为 {}",
            agent.name,
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
            if let Ok(app_dir) = Self::get_app_agents_dir(&app) {
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

        // 检查是否有 Agents 使用此命名空间
        let agents = db.get_agents_by_namespace(namespace)?;
        if !agents.is_empty() {
            return Err(anyhow!(
                "命名空间 {} 不为空，包含 {} 个 Agents",
                namespace,
                agents.len()
            ));
        }

        let ssot_dir = Self::get_ssot_dir()?;
        let ns_dir = ssot_dir.join(namespace);
        if ns_dir.exists() {
            fs::remove_dir(&ns_dir)?;
        }

        // 同时从各应用目录删除
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            if let Ok(app_dir) = Self::get_app_agents_dir(&app) {
                let app_ns_dir = app_dir.join(namespace);
                let _ = fs::remove_dir(&app_ns_dir);
            }
        }

        log::info!("命名空间 {} 删除成功", namespace);

        Ok(())
    }

    /// 获取所有命名空间
    pub fn get_namespaces(db: &Arc<Database>) -> Result<Vec<crate::app_config::AgentNamespace>> {
        db.get_agent_namespaces()
            .map_err(|e| anyhow!("获取命名空间失败: {}", e))
    }

    /// 获取 Agent 文件内容
    pub fn get_agent_content(id: &str) -> Result<String> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Agent 不存在: {}", id));
        }

        fs::read_to_string(&path).map_err(|e| anyhow!("读取文件失败: {}", e))
    }

    /// 在外部编辑器中打开 Agent
    pub fn open_in_editor(id: &str) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let path = ssot_dir.join(relative_path);

        if !path.exists() {
            return Err(anyhow!("Agent 不存在: {}", id));
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

    /// 扫描未管理的 Agents
    ///
    /// 扫描各应用目录，找出未被 CC Switch 管理的 Agents
    pub fn scan_unmanaged(db: &Arc<Database>) -> Result<Vec<UnmanagedAgent>> {
        let managed_agents = db.get_all_installed_agents()?;
        let managed_ids: HashSet<String> = managed_agents.keys().cloned().collect();

        let mut unmanaged: HashMap<String, UnmanagedAgent> = HashMap::new();

        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            let app_dir = match Self::get_app_agents_dir(&app) {
                Ok(d) => d,
                Err(_) => continue,
            };

            if !app_dir.exists() {
                continue;
            }

            Self::scan_dir_for_agents(&app_dir, &app_dir, &app, &managed_ids, &mut unmanaged)?;
        }

        Ok(unmanaged.into_values().collect())
    }

    /// 递归扫描目录查找 .md 文件
    fn scan_dir_for_agents(
        current_dir: &Path,
        base_dir: &Path,
        app: &AppType,
        managed_ids: &HashSet<String>,
        unmanaged: &mut HashMap<String, UnmanagedAgent>,
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
                Self::scan_dir_for_agents(&path, base_dir, app, managed_ids, unmanaged)?;
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                let relative = path.strip_prefix(base_dir).unwrap_or(&path);
                let id = Self::relative_path_to_id(relative);

                // 跳过已管理的
                if managed_ids.contains(&id) {
                    continue;
                }

                // 解析元数据
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = Self::parse_agent_metadata(&content).unwrap_or_default();

                let (namespace, filename) = Self::parse_id(&id);

                let app_str = match app {
                    AppType::Claude => "claude",
                    AppType::Codex => "codex",
                    AppType::Gemini => "gemini",
                };

                unmanaged
                    .entry(id.clone())
                    .and_modify(|a| a.found_in.push(app_str.to_string()))
                    .or_insert(UnmanagedAgent {
                        id: id.clone(),
                        namespace,
                        filename,
                        name: metadata.name.unwrap_or_else(|| id.clone()),
                        description: metadata.description,
                        model: metadata.model,
                        tools: metadata.tools,
                        found_in: vec![app_str.to_string()],
                    });
            }
        }

        Ok(())
    }

    /// 从应用目录导入 Agents
    ///
    /// 将未管理的 Agents 导入到 CC Switch 统一管理
    pub fn import_from_apps(
        db: &Arc<Database>,
        agent_ids: Vec<String>,
    ) -> Result<Vec<InstalledAgent>> {
        let ssot_dir = Self::get_ssot_dir()?;
        let mut imported = Vec::new();

        for id in agent_ids {
            let relative_path = Self::id_to_relative_path(&id);
            let mut source_path: Option<PathBuf> = None;
            let mut found_in: Vec<String> = Vec::new();

            // 找到源文件
            for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
                if let Ok(app_dir) = Self::get_app_agents_dir(&app) {
                    let agent_path = app_dir.join(&relative_path);
                    if agent_path.exists() {
                        if source_path.is_none() {
                            source_path = Some(agent_path);
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
            let metadata = Self::parse_agent_metadata(&content)?;
            let file_hash = Self::compute_hash(&content);
            let (namespace, filename) = Self::parse_id(&id);

            // 构建启用状态
            let mut apps = AgentApps::default();
            for app_str in &found_in {
                match app_str.as_str() {
                    "claude" => apps.claude = true,
                    "codex" => apps.codex = true,
                    "gemini" => apps.gemini = true,
                    _ => {}
                }
            }

            // 创建记录
            let agent = InstalledAgent {
                id: id.clone(),
                name: metadata.name.unwrap_or_else(|| filename.clone()),
                description: metadata.description,
                namespace,
                filename,
                model: metadata.model,
                tools: metadata.tools,
                extra_metadata: None,
                repo_owner: None,
                repo_name: None,
                repo_branch: None,
                readme_url: None,
                source_path: None,
                apps,
                file_hash: Some(file_hash),
                installed_at: chrono::Utc::now().timestamp(),
            };

            // 保存到数据库
            db.save_agent(&agent)?;
            imported.push(agent);
        }

        log::info!("成功导入 {} 个 Agents", imported.len());

        Ok(imported)
    }

    // ========== 文件同步方法 ==========

    /// 复制 Agent 到应用目录
    pub fn copy_to_app(id: &str, app: &AppType) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let relative_path = Self::id_to_relative_path(id);
        let source = ssot_dir.join(&relative_path);

        if !source.exists() {
            return Err(anyhow!("Agent 不存在于 SSOT: {}", id));
        }

        let app_dir = Self::get_app_agents_dir(app)?;
        let dest = app_dir.join(&relative_path);

        // 确保父目录存在
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::copy(&source, &dest)?;

        log::debug!("Agent {} 已复制到 {:?}", id, app);

        Ok(())
    }

    /// 从应用目录删除 Agent
    pub fn remove_from_app(id: &str, app: &AppType) -> Result<()> {
        let app_dir = Self::get_app_agents_dir(app)?;
        let relative_path = Self::id_to_relative_path(id);
        let agent_path = app_dir.join(&relative_path);

        if agent_path.exists() {
            fs::remove_file(&agent_path)?;
            log::debug!("Agent {} 已从 {:?} 删除", id, app);

            // 清理空的命名空间目录
            if let Some(parent) = agent_path.parent() {
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

    /// 同步所有已启用的 Agents 到指定应用
    pub fn sync_to_app(db: &Arc<Database>, app: &AppType) -> Result<()> {
        let agents = db.get_all_installed_agents()?;

        for agent in agents.values() {
            if agent.apps.is_enabled_for(app.as_str()) {
                Self::copy_to_app(&agent.id, app)?;
            }
        }

        Ok(())
    }

    // ========== 发现功能 ==========

    /// 列出所有可发现的 Agents（从仓库获取，带缓存支持）
    ///
    /// # 参数
    /// - `db`: 数据库连接，用于缓存查询和存储
    /// - `repos`: 仓库列表（与 Commands 共用）
    /// - `force_refresh`: 是否强制刷新（跳过缓存）
    ///
    /// # 缓存策略
    /// - 缓存有效期：24小时
    /// - 强制刷新时跳过缓存直接从 GitHub 获取
    /// - 获取成功后更新缓存
    pub async fn discover_available(
        &self,
        db: &Arc<Database>,
        repos: Vec<CommandRepo>,
        force_refresh: bool,
    ) -> Result<Vec<DiscoverableAgent>> {
        use crate::database::CACHE_EXPIRY_SECONDS;

        let mut agents = Vec::new();

        // 仅使用启用的仓库
        let enabled_repos: Vec<CommandRepo> =
            repos.into_iter().filter(|repo| repo.enabled).collect();

        // 先清理过期缓存
        if let Err(e) = db.cleanup_expired_agent_cache() {
            log::warn!("清理过期 Agent 缓存失败: {}", e);
        }

        // 分离：需要从网络获取的仓库 vs 可以使用缓存的仓库
        let mut repos_to_fetch = Vec::new();
        let mut cached_agents = Vec::new();

        for repo in &enabled_repos {
            if force_refresh {
                repos_to_fetch.push(repo.clone());
                continue;
            }

            // 尝试从缓存获取
            match db.get_cached_agents(&repo.owner, &repo.name, &repo.branch) {
                Ok(Some(cache)) => {
                    // 检查缓存是否过期
                    let now = chrono::Utc::now().timestamp();
                    if now - cache.scanned_at < CACHE_EXPIRY_SECONDS {
                        log::debug!(
                            "使用 Agent 缓存: {}/{} ({} 个 agents)",
                            repo.owner,
                            repo.name,
                            cache.agents.len()
                        );
                        cached_agents.extend(cache.agents);
                    } else {
                        log::debug!("Agent 缓存过期: {}/{}", repo.owner, repo.name);
                        repos_to_fetch.push(repo.clone());
                    }
                }
                Ok(None) => {
                    log::debug!("无 Agent 缓存: {}/{}", repo.owner, repo.name);
                    repos_to_fetch.push(repo.clone());
                }
                Err(e) => {
                    log::warn!("读取 Agent 缓存失败: {}/{}: {}", repo.owner, repo.name, e);
                    repos_to_fetch.push(repo.clone());
                }
            }
        }

        // 从网络获取需要刷新的仓库
        if !repos_to_fetch.is_empty() {
            let db_clone = Arc::clone(db);
            let fetch_tasks = repos_to_fetch
                .iter()
                .map(|repo| self.fetch_repo_agents_with_cache(repo, &db_clone));

            let results: Vec<Result<Vec<DiscoverableAgent>>> =
                futures::future::join_all(fetch_tasks).await;

            for (repo, result) in repos_to_fetch.into_iter().zip(results.into_iter()) {
                match result {
                    Ok(repo_agents) => agents.extend(repo_agents),
                    Err(e) => log::warn!(
                        "获取仓库 {}/{} Agents 失败: {}",
                        repo.owner,
                        repo.name,
                        e
                    ),
                }
            }
        }

        // 合并缓存的 agents
        agents.extend(cached_agents);

        // 去重并排序
        Self::deduplicate_agents(&mut agents);
        agents.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        Ok(agents)
    }

    /// 从仓库获取 Agents 列表并更新缓存
    async fn fetch_repo_agents_with_cache(
        &self,
        repo: &CommandRepo,
        db: &Arc<Database>,
    ) -> Result<Vec<DiscoverableAgent>> {
        let agents = self.fetch_repo_agents(repo).await?;

        // 保存到缓存
        if let Err(e) = db.save_cached_agents(&repo.owner, &repo.name, &repo.branch, &agents) {
            log::warn!(
                "保存 Agent 缓存失败: {}/{}: {}",
                repo.owner,
                repo.name,
                e
            );
        } else {
            log::debug!(
                "已缓存 Agents: {}/{} ({} 个)",
                repo.owner,
                repo.name,
                agents.len()
            );
        }

        Ok(agents)
    }

    /// 从仓库获取 Agents 列表（不带缓存）
    async fn fetch_repo_agents(&self, repo: &CommandRepo) -> Result<Vec<DiscoverableAgent>> {
        let temp_dir = timeout(
            std::time::Duration::from_secs(60),
            self.download_repo(repo),
        )
        .await
        .map_err(|_| anyhow!("下载仓库超时: {}/{}", repo.owner, repo.name))??;

        let mut agents = Vec::new();

        // 扫描根目录和子目录
        Self::scan_repo_for_agents(&temp_dir, &temp_dir, repo, &mut agents)?;

        let _ = fs::remove_dir_all(&temp_dir);

        Ok(agents)
    }

    /// 扫描仓库查找所有 agents 目录中的 agent 文件
    ///
    /// 策略：
    /// 1. 浅层扫描（最多3层）查找所有名为 `agents` 的目录
    /// 2. 对每个 agents 目录，计算其父目录作为命名空间
    /// 3. 扫描该目录内的 .md 文件
    fn scan_repo_for_agents(
        _current_dir: &Path,
        base_dir: &Path,
        repo: &CommandRepo,
        agents: &mut Vec<DiscoverableAgent>,
    ) -> Result<()> {
        // 查找所有 agents 目录
        let agents_dirs = Self::find_agents_directories(base_dir, 3)?;

        for agents_dir in agents_dirs {
            // 计算命名空间：agents 目录的父目录名
            // plugins/bun/agents -> namespace = "bun"
            // agents -> namespace = ""
            let namespace = Self::compute_namespace(&agents_dir, base_dir);

            // 扫描该 agents 目录内的所有 .md 文件
            Self::scan_agents_directory(
                &agents_dir,
                &agents_dir,
                base_dir,
                &namespace,
                repo,
                agents,
            )?;
        }

        Ok(())
    }

    /// 浅层扫描查找所有名为 `agents` 的目录
    fn find_agents_directories(base_dir: &Path, max_depth: usize) -> Result<Vec<PathBuf>> {
        let mut result = Vec::new();
        Self::find_agents_directories_recursive(base_dir, 0, max_depth, &mut result)?;
        Ok(result)
    }

    fn find_agents_directories_recursive(
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
            Err(_) => return Ok(()), // 跳过无法读取的目录
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
                if name == "agents" {
                    // 找到 agents 目录，添加到结果
                    result.push(path);
                    // 不再递归进入 agents 目录查找嵌套的 agents
                } else {
                    // 继续向下搜索
                    Self::find_agents_directories_recursive(
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

    /// 计算命名空间：agents 目录的父目录名
    ///
    /// - `plugins/bun/agents` -> "bun"
    /// - `agents` -> ""
    /// - `some/deep/path/agents` -> "path"
    fn compute_namespace(agents_dir: &Path, base_dir: &Path) -> String {
        // 获取相对路径
        let relative = agents_dir.strip_prefix(base_dir).unwrap_or(agents_dir);

        // 获取父目录
        if let Some(parent) = relative.parent() {
            if parent.as_os_str().is_empty() {
                // agents 在根目录
                String::new()
            } else {
                // 取父目录的最后一个组件作为命名空间
                parent
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default()
            }
        } else {
            String::new()
        }
    }

    /// 扫描单个 agents 目录内的 .md 文件
    fn scan_agents_directory(
        current_dir: &Path,
        agents_root: &Path,
        base_dir: &Path,
        namespace: &str,
        repo: &CommandRepo,
        agents: &mut Vec<DiscoverableAgent>,
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

            // 跳过非 agent 文件
            let skip_files = ["README.md", "LICENSE.md", "CHANGELOG.md", "CONTRIBUTING.md"];
            if skip_files.contains(&name.as_str()) {
                continue;
            }

            if path.is_dir() {
                // 递归扫描子目录
                Self::scan_agents_directory(
                    &path,
                    agents_root,
                    base_dir,
                    namespace,
                    repo,
                    agents,
                )?;
            } else if path.extension().map(|e| e == "md").unwrap_or(false) {
                // 计算文件在 agents 目录内的相对路径
                let relative_in_agents = path.strip_prefix(agents_root).unwrap_or(&path);
                let filename_path = relative_in_agents.with_extension("");
                let filename_str = filename_path.to_string_lossy().replace('\\', "/");

                // 计算完整 ID
                // 如果有命名空间：namespace/filename (可能包含子目录)
                // 如果没有命名空间：filename
                let id = if namespace.is_empty() {
                    filename_str.clone()
                } else {
                    format!("{}/{}", namespace, filename_str)
                };

                // 计算 source_path（相对于仓库根目录）
                let source_path = path
                    .strip_prefix(base_dir)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .replace('\\', "/");

                // 解析元数据
                let content = fs::read_to_string(&path).unwrap_or_default();
                let metadata = Self::parse_agent_metadata(&content).unwrap_or_default();

                // 解析 ID 得到最终的命名空间和文件名
                let (final_namespace, final_filename) = Self::parse_id(&id);

                agents.push(DiscoverableAgent {
                    key: id,
                    name: metadata.name.unwrap_or_else(|| final_filename.clone()),
                    description: metadata.description.unwrap_or_default(),
                    namespace: final_namespace,
                    filename: final_filename,
                    model: metadata.model,
                    tools: metadata.tools,
                    readme_url: Some(format!(
                        "https://github.com/{}/{}/blob/{}/{}",
                        repo.owner, repo.name, repo.branch, source_path
                    )),
                    repo_owner: repo.owner.clone(),
                    repo_name: repo.name.clone(),
                    repo_branch: repo.branch.clone(),
                    source_path: Some(source_path),
                });
            }
        }

        Ok(())
    }

    /// 下载单个 Agent 内容
    async fn download_agent_content(&self, agent: &DiscoverableAgent) -> Result<String> {
        // 优先使用 source_path（完整仓库路径），否则回退到旧逻辑
        let file_path = agent
            .source_path
            .clone()
            .unwrap_or_else(|| format!("{}.md", agent.key));

        let url = format!(
            "https://raw.githubusercontent.com/{}/{}/{}/{}",
            agent.repo_owner, agent.repo_name, agent.repo_branch, file_path
        );

        let response = self.http_client.get(&url).send().await?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "下载 Agent 失败: {} ({})",
                agent.key,
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
            "cc-switch-agents-{}-{}-{}",
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
                    // 移除仓库名前缀（例如 "repo-main/..."）
                    let components: Vec<_> = path.components().collect();
                    if components.len() > 1 {
                        let rest: PathBuf = components[1..].iter().collect();
                        temp_dir.join(rest)
                    } else {
                        continue; // 跳过根目录
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

    /// 去重 Agents（按 key 去重，优先保留第一个）
    fn deduplicate_agents(agents: &mut Vec<DiscoverableAgent>) {
        let mut seen = HashSet::new();
        agents.retain(|agent| {
            if seen.contains(&agent.key) {
                false
            } else {
                seen.insert(agent.key.clone());
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

    // ========== 变更检测与冲突解决 ==========

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

    /// 解析 frontmatter（返回 Option，解析失败返回 None）
    fn parse_frontmatter(content: &str) -> Option<AgentMetadata> {
        Self::parse_agent_metadata(content).ok()
    }

    /// 检测所有变更
    ///
    /// 扫描 SSOT 目录和应用目录，检测：
    /// - SSOT 文件修改/删除
    /// - 应用目录与 SSOT 不一致（冲突）
    pub fn detect_changes(db: &Arc<Database>) -> Result<Vec<ChangeEvent>> {
        let mut events = Vec::new();
        let ssot_dir = Self::get_ssot_dir()?;

        if !ssot_dir.exists() {
            return Ok(events);
        }

        // 获取所有已安装的 agents
        let installed = Self::get_all_installed(db)?;
        let installed_map: HashMap<String, InstalledAgent> =
            installed.into_iter().map(|a| (a.id.clone(), a)).collect();

        // 扫描 SSOT 目录
        let ssot_files = Self::scan_ssot_files(&ssot_dir)?;
        for (id, path) in &ssot_files {
            if !installed_map.contains_key(id) {
                // SSOT 中有但数据库中没有（新增）
                let relative = path.strip_prefix(&ssot_dir).unwrap_or(path);
                events.push(ChangeEvent {
                    id: id.clone(),
                    event_type: ChangeEventType::SsotAdded,
                    app: None,
                    details: Some(format!("发现新文件: {}", relative.display())),
                });
            }
        }

        // 检查应用目录冲突
        for app in [AppType::Claude, AppType::Codex, AppType::Gemini] {
            if let Ok(app_dir) = Self::get_app_agents_dir(&app) {
                if !app_dir.exists() {
                    continue;
                }

                let app_files = Self::scan_ssot_files(&app_dir)?;
                for (id, app_path) in &app_files {
                    // 检查是否与 SSOT 内容一致
                    let relative = app_path.strip_prefix(&app_dir).unwrap_or(app_path);
                    let ssot_path = ssot_dir.join(relative);
                    if ssot_path.exists() {
                        let app_content = fs::read_to_string(app_path).unwrap_or_default();
                        let ssot_content = fs::read_to_string(&ssot_path).unwrap_or_default();

                        if app_content != ssot_content {
                            events.push(ChangeEvent {
                                id: id.clone(),
                                event_type: ChangeEventType::AppConflict,
                                app: Some(app.as_str().to_string()),
                                details: Some("应用目录与 SSOT 内容不一致".to_string()),
                            });
                        }
                    }
                }
            }
        }

        Ok(events)
    }

    /// 解决冲突
    pub fn resolve_conflict(
        db: &Arc<Database>,
        id: &str,
        app: &AppType,
        resolution: ConflictResolution,
    ) -> Result<()> {
        let ssot_dir = Self::get_ssot_dir()?;
        let app_dir = Self::get_app_agents_dir(app)?;
        let relative_path = Self::id_to_relative_path(id);

        let ssot_path = ssot_dir.join(&relative_path);
        let app_path = app_dir.join(&relative_path);

        match resolution {
            ConflictResolution::KeepSsot => {
                // 用 SSOT 覆盖应用目录
                if ssot_path.exists() && app_path.exists() {
                    fs::copy(&ssot_path, &app_path)?;
                }
            }
            ConflictResolution::KeepApp => {
                // 用应用目录覆盖 SSOT
                if app_path.exists() {
                    if let Some(parent) = ssot_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(&app_path, &ssot_path)?;

                    // 更新数据库中的元数据
                    let content = fs::read_to_string(&ssot_path)?;
                    if let Some(metadata) = Self::parse_frontmatter(&content) {
                        let (namespace, filename) = Self::parse_id(id);
                        let file_hash = Self::compute_hash(&content);

                        // 获取现有记录以保留某些字段
                        let existing = db.get_installed_agent(id)?;

                        let agent = InstalledAgent {
                            id: id.to_string(),
                            name: metadata.name.unwrap_or_else(|| filename.clone()),
                            description: metadata.description,
                            namespace: namespace.clone(),
                            filename: filename.clone(),
                            model: metadata.model,
                            tools: metadata.tools,
                            extra_metadata: None,
                            repo_owner: existing.as_ref().and_then(|e| e.repo_owner.clone()),
                            repo_name: existing.as_ref().and_then(|e| e.repo_name.clone()),
                            repo_branch: existing.as_ref().and_then(|e| e.repo_branch.clone()),
                            readme_url: existing.as_ref().and_then(|e| e.readme_url.clone()),
                            source_path: Some(relative_path.to_string_lossy().to_string()),
                            apps: existing.map(|e| e.apps).unwrap_or_default(),
                            file_hash: Some(file_hash),
                            installed_at: chrono::Utc::now().timestamp(),
                        };

                        db.save_agent(&agent)
                            .map_err(|e| anyhow!("更新 agent 失败: {}", e))?;
                    }
                }
            }
        }

        Ok(())
    }

    // ========== SSOT 刷新与同步 ==========

    /// 从 SSOT 目录刷新数据库
    ///
    /// 重新解析所有 Agent 文件，更新数据库中的元数据
    /// 返回更新的 agent 数量
    pub fn refresh_from_ssot(db: &Arc<Database>) -> Result<usize> {
        let ssot_dir = Self::get_ssot_dir()?;

        if !ssot_dir.exists() {
            return Ok(0);
        }

        // 扫描 SSOT 目录中的所有 .md 文件
        let ssot_files = Self::scan_ssot_files(&ssot_dir)?;
        let mut updated = 0;

        for (id, path) in ssot_files {
            if let Ok(content) = fs::read_to_string(&path) {
                let metadata = Self::parse_frontmatter(&content).unwrap_or_default();
                let (namespace, filename) = Self::parse_id(&id);
                let relative = path.strip_prefix(&ssot_dir).unwrap_or(&path);
                let file_hash = Self::compute_hash(&content);

                // 尝试获取现有记录以保留某些字段
                let existing = db.get_installed_agent(&id)?;

                let agent = InstalledAgent {
                    id: id.clone(),
                    name: metadata.name.unwrap_or_else(|| filename.clone()),
                    description: metadata.description,
                    namespace,
                    filename: filename.clone(),
                    model: metadata.model,
                    tools: metadata.tools,
                    extra_metadata: None,
                    repo_owner: existing.as_ref().and_then(|e| e.repo_owner.clone()),
                    repo_name: existing.as_ref().and_then(|e| e.repo_name.clone()),
                    repo_branch: existing.as_ref().and_then(|e| e.repo_branch.clone()),
                    readme_url: existing.as_ref().and_then(|e| e.readme_url.clone()),
                    source_path: Some(relative.to_string_lossy().to_string()),
                    apps: existing.map(|e| e.apps).unwrap_or_default(),
                    file_hash: Some(file_hash),
                    installed_at: chrono::Utc::now().timestamp(),
                };

                // save_agent 会自动处理插入或更新
                db.save_agent(&agent)
                    .map_err(|e| anyhow!("保存 agent 失败: {}", e))?;
                updated += 1;
            }
        }

        Ok(updated)
    }

    /// 同步所有已启用的 Agents 到应用目录
    ///
    /// 确保所有已启用的应用目录与 SSOT 保持一致
    /// 返回同步的文件数量
    pub fn sync_all_to_apps(db: &Arc<Database>) -> Result<usize> {
        let agents = Self::get_all_installed(db)?;
        let ssot_dir = Self::get_ssot_dir()?;
        let mut synced = 0;

        for agent in agents {
            let relative_path = Self::id_to_relative_path(&agent.id);
            let ssot_path = ssot_dir.join(&relative_path);

            if !ssot_path.exists() {
                continue;
            }

            // 同步到各个已启用的应用
            for (app_type, enabled) in [
                (AppType::Claude, agent.apps.claude),
                (AppType::Codex, agent.apps.codex),
                (AppType::Gemini, agent.apps.gemini),
            ] {
                if !enabled {
                    continue;
                }

                if let Ok(app_dir) = Self::get_app_agents_dir(&app_type) {
                    let app_path = app_dir.join(&relative_path);

                    // 确保父目录存在
                    if let Some(parent) = app_path.parent() {
                        fs::create_dir_all(parent)?;
                    }

                    // 复制文件
                    fs::copy(&ssot_path, &app_path)?;
                    synced += 1;
                }
            }
        }

        Ok(synced)
    }
}

// ========== 变更事件类型 ==========

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

/// 检查应用是否支持 Agents 功能
pub fn check_app_agents_support(app: &AppType) -> bool {
    // 目前只有 Claude Code 确定支持 Agents
    // Codex 和 Gemini 需要后续确认
    match app {
        AppType::Claude => true,
        AppType::Codex => false, // TODO: 确认 Codex CLI 是否支持
        AppType::Gemini => false, // TODO: 确认 Gemini CLI 是否支持
    }
}
