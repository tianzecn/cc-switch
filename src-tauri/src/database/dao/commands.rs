//! Commands DAO - 数据访问对象
//!
//! 提供 Commands 表的 CRUD 操作

use crate::app_config::{
    CommandApps, CommandNamespace, CommandRepo, DiscoverableCommand, InstalledCommand,
};
use crate::database::{lock_conn, to_json_string, Database};
use crate::error::AppError;
use indexmap::IndexMap;
use rusqlite::{params, OptionalExtension};

/// 缓存过期时间：24小时（秒）
pub const CACHE_EXPIRY_SECONDS: i64 = 24 * 60 * 60;

/// Command 发现缓存条目
#[derive(Debug, Clone)]
pub struct CommandDiscoveryCache {
    pub repo_owner: String,
    pub repo_name: String,
    pub repo_branch: String,
    pub commands: Vec<DiscoverableCommand>,
    pub scanned_at: i64,
}

impl Database {
    // ========== Commands CRUD ==========

    /// 获取所有已安装的 Commands
    pub fn get_all_installed_commands(&self) -> Result<IndexMap<String, InstalledCommand>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename, category,
                       allowed_tools, mcp_servers, personas, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM commands
                ORDER BY namespace, filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(InstalledCommand {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    category: row.get(5)?,
                    allowed_tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    mcp_servers: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    personas: row
                        .get::<_, Option<String>>(8)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(10)?,
                    repo_name: row.get(11)?,
                    repo_branch: row.get(12)?,
                    readme_url: row.get(13)?,
                    source_path: row.get(14)?,
                    apps: CommandApps {
                        claude: row.get::<_, i32>(15)? != 0,
                        codex: row.get::<_, i32>(16)? != 0,
                        gemini: row.get::<_, i32>(17)? != 0,
                    },
                    file_hash: row.get(18)?,
                    installed_at: row.get(19)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut commands = IndexMap::new();
        for row in rows {
            let command = row.map_err(|e| AppError::Database(e.to_string()))?;
            commands.insert(command.id.clone(), command);
        }

        Ok(commands)
    }

    /// 获取单个 Command
    pub fn get_installed_command(&self, id: &str) -> Result<Option<InstalledCommand>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename, category,
                       allowed_tools, mcp_servers, personas, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM commands
                WHERE id = ?1
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![id], |row| {
                Ok(InstalledCommand {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    category: row.get(5)?,
                    allowed_tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    mcp_servers: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    personas: row
                        .get::<_, Option<String>>(8)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(10)?,
                    repo_name: row.get(11)?,
                    repo_branch: row.get(12)?,
                    readme_url: row.get(13)?,
                    source_path: row.get(14)?,
                    apps: CommandApps {
                        claude: row.get::<_, i32>(15)? != 0,
                        codex: row.get::<_, i32>(16)? != 0,
                        gemini: row.get::<_, i32>(17)? != 0,
                    },
                    file_hash: row.get(18)?,
                    installed_at: row.get(19)?,
                })
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(result)
    }

    /// 保存 Command（插入或更新）
    pub fn save_command(&self, command: &InstalledCommand) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            r#"
            INSERT OR REPLACE INTO commands (
                id, name, description, namespace, filename, category,
                allowed_tools, mcp_servers, personas, extra_metadata,
                repo_owner, repo_name, repo_branch, readme_url, source_path,
                enabled_claude, enabled_codex, enabled_gemini,
                file_hash, installed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                command.id,
                command.name,
                command.description,
                command.namespace,
                command.filename,
                command.category,
                command.allowed_tools.as_ref().map(|v| to_json_string(v)).transpose()?,
                command.mcp_servers.as_ref().map(|v| to_json_string(v)).transpose()?,
                command.personas.as_ref().map(|v| to_json_string(v)).transpose()?,
                command.extra_metadata.as_ref().map(|v| to_json_string(v)).transpose()?,
                command.repo_owner,
                command.repo_name,
                command.repo_branch,
                command.readme_url,
                command.source_path,
                command.apps.claude as i32,
                command.apps.codex as i32,
                command.apps.gemini as i32,
                command.file_hash,
                command.installed_at,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除 Command
    pub fn delete_command(&self, id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM commands WHERE id = ?1", params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Command 的应用启用状态
    pub fn update_command_apps(&self, id: &str, apps: &CommandApps) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                UPDATE commands
                SET enabled_claude = ?1, enabled_codex = ?2, enabled_gemini = ?3
                WHERE id = ?4
                "#,
                params![
                    apps.claude as i32,
                    apps.codex as i32,
                    apps.gemini as i32,
                    id,
                ],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Command 的文件哈希
    pub fn update_command_hash(&self, id: &str, file_hash: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE commands SET file_hash = ?1 WHERE id = ?2",
                params![file_hash, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 按命名空间获取 Commands
    pub fn get_commands_by_namespace(
        &self,
        namespace: &str,
    ) -> Result<Vec<InstalledCommand>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename, category,
                       allowed_tools, mcp_servers, personas, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM commands
                WHERE namespace = ?1
                ORDER BY filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map(params![namespace], |row| {
                Ok(InstalledCommand {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    category: row.get(5)?,
                    allowed_tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    mcp_servers: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    personas: row
                        .get::<_, Option<String>>(8)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(9)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(10)?,
                    repo_name: row.get(11)?,
                    repo_branch: row.get(12)?,
                    readme_url: row.get(13)?,
                    source_path: row.get(14)?,
                    apps: CommandApps {
                        claude: row.get::<_, i32>(15)? != 0,
                        codex: row.get::<_, i32>(16)? != 0,
                        gemini: row.get::<_, i32>(17)? != 0,
                    },
                    file_hash: row.get(18)?,
                    installed_at: row.get(19)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut commands = Vec::new();
        for row in rows {
            commands.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(commands)
    }

    /// 获取所有命名空间及其 Command 数量
    pub fn get_command_namespaces(&self) -> Result<Vec<CommandNamespace>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT namespace, COUNT(*) as count
                FROM commands
                GROUP BY namespace
                ORDER BY namespace
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                let namespace: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok(CommandNamespace {
                    name: namespace.clone(),
                    display_name: if namespace.is_empty() {
                        "Root".to_string()
                    } else {
                        namespace
                    },
                    command_count: count as usize,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut namespaces = Vec::new();
        for row in rows {
            namespaces.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(namespaces)
    }

    // ========== Command Repos CRUD ==========

    /// 获取所有 Command 仓库
    pub fn get_all_command_repos(&self) -> Result<Vec<CommandRepo>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT owner, name, branch, enabled
                FROM command_repos
                ORDER BY owner, name
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(CommandRepo {
                    owner: row.get(0)?,
                    name: row.get(1)?,
                    branch: row.get(2)?,
                    enabled: row.get::<_, i32>(3)? != 0,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut repos = Vec::new();
        for row in rows {
            repos.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(repos)
    }

    /// 添加 Command 仓库
    pub fn add_command_repo(&self, repo: &CommandRepo) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            r#"
            INSERT OR REPLACE INTO command_repos (owner, name, branch, enabled)
            VALUES (?1, ?2, ?3, ?4)
            "#,
            params![repo.owner, repo.name, repo.branch, repo.enabled as i32],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除 Command 仓库
    pub fn remove_command_repo(&self, owner: &str, name: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM command_repos WHERE owner = ?1 AND name = ?2",
                params![owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Command 仓库启用状态
    pub fn update_command_repo_enabled(
        &self,
        owner: &str,
        name: &str,
        enabled: bool,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE command_repos SET enabled = ?1 WHERE owner = ?2 AND name = ?3",
                params![enabled as i32, owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 检查 commands 表是否为空
    pub fn is_commands_table_empty(&self) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM commands", [], |row| row.get(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(count == 0)
    }

    // ========== Command Discovery Cache ==========

    /// 获取仓库的缓存 Commands（如果未过期）
    ///
    /// 返回 None 如果缓存不存在或已过期
    pub fn get_cached_commands(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<Option<CommandDiscoveryCache>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT repo_owner, repo_name, repo_branch, commands_json, scanned_at
                FROM command_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![owner, name, branch], |row| {
                let commands_json: String = row.get(3)?;
                let scanned_at: i64 = row.get(4)?;

                // 检查是否过期
                let now = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                if now - scanned_at > CACHE_EXPIRY_SECONDS {
                    // 缓存已过期
                    return Ok(None);
                }

                // 解析 JSON
                let commands: Vec<DiscoverableCommand> =
                    serde_json::from_str(&commands_json).unwrap_or_default();

                Ok(Some(CommandDiscoveryCache {
                    repo_owner: row.get(0)?,
                    repo_name: row.get(1)?,
                    repo_branch: row.get(2)?,
                    commands,
                    scanned_at,
                }))
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        // 展平 Option<Option<T>> -> Option<T>
        Ok(result.flatten())
    }

    /// 保存 Commands 到缓存
    pub fn save_cached_commands(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
        commands: &[DiscoverableCommand],
    ) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        let commands_json = to_json_string(commands)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO command_discovery_cache
                (repo_owner, repo_name, repo_branch, commands_json, scanned_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![owner, name, branch, commands_json, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除指定仓库的缓存
    pub fn delete_cached_commands(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                DELETE FROM command_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
                params![owner, name, branch],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 删除指定仓库的所有分支缓存
    pub fn delete_repo_cache(&self, owner: &str, name: &str) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM command_discovery_cache WHERE repo_owner = ?1 AND repo_name = ?2",
                params![owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清空所有缓存
    pub fn clear_all_command_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM command_discovery_cache", [])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清理过期的缓存条目
    pub fn cleanup_expired_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let cutoff = now - CACHE_EXPIRY_SECONDS;

        let affected = conn
            .execute(
                "DELETE FROM command_discovery_cache WHERE scanned_at < ?1",
                params![cutoff],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_command(id: &str, namespace: &str, filename: &str) -> InstalledCommand {
        InstalledCommand {
            id: id.to_string(),
            name: format!("Test Command {}", filename),
            description: Some("A test command".to_string()),
            namespace: namespace.to_string(),
            filename: filename.to_string(),
            category: Some("test".to_string()),
            allowed_tools: Some(vec!["Bash".to_string(), "Read".to_string()]),
            mcp_servers: None,
            personas: None,
            extra_metadata: None,
            repo_owner: Some("test-owner".to_string()),
            repo_name: Some("test-repo".to_string()),
            repo_branch: Some("main".to_string()),
            readme_url: None,
            source_path: Some(format!("commands/{}/{}.md", namespace, filename)),
            apps: CommandApps {
                claude: true,
                codex: false,
                gemini: false,
            },
            file_hash: Some("abc123".to_string()),
            installed_at: 1700000000,
        }
    }

    #[test]
    fn test_command_crud() {
        let db = Database::memory().unwrap();

        // Test save and get
        let command = create_test_command("sc/agent", "sc", "agent");
        db.save_command(&command).unwrap();

        let retrieved = db.get_installed_command("sc/agent").unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, "sc/agent");
        assert_eq!(retrieved.namespace, "sc");
        assert_eq!(retrieved.filename, "agent");
        assert!(retrieved.apps.claude);
        assert!(!retrieved.apps.codex);

        // Test get all
        let all = db.get_all_installed_commands().unwrap();
        assert_eq!(all.len(), 1);

        // Test update apps
        let new_apps = CommandApps {
            claude: true,
            codex: true,
            gemini: false,
        };
        db.update_command_apps("sc/agent", &new_apps).unwrap();
        let updated = db.get_installed_command("sc/agent").unwrap().unwrap();
        assert!(updated.apps.codex);

        // Test delete
        let deleted = db.delete_command("sc/agent").unwrap();
        assert!(deleted);
        let after_delete = db.get_installed_command("sc/agent").unwrap();
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_commands_by_namespace() {
        let db = Database::memory().unwrap();

        // Add commands in different namespaces
        db.save_command(&create_test_command("commit", "", "commit"))
            .unwrap();
        db.save_command(&create_test_command("sc/agent", "sc", "agent"))
            .unwrap();
        db.save_command(&create_test_command("sc/task", "sc", "task"))
            .unwrap();
        db.save_command(&create_test_command("zcf/feat", "zcf", "feat"))
            .unwrap();

        // Test get by namespace
        let root_commands = db.get_commands_by_namespace("").unwrap();
        assert_eq!(root_commands.len(), 1);

        let sc_commands = db.get_commands_by_namespace("sc").unwrap();
        assert_eq!(sc_commands.len(), 2);

        // Test get namespaces
        let namespaces = db.get_command_namespaces().unwrap();
        assert_eq!(namespaces.len(), 3); // "", "sc", "zcf"

        // Find the root namespace
        let root_ns = namespaces.iter().find(|ns| ns.name.is_empty());
        assert!(root_ns.is_some());
        assert_eq!(root_ns.unwrap().display_name, "Root");
        assert_eq!(root_ns.unwrap().command_count, 1);
    }

    #[test]
    fn test_command_repos() {
        let db = Database::memory().unwrap();

        let repo = CommandRepo {
            owner: "anthropics".to_string(),
            name: "claude-commands".to_string(),
            branch: "main".to_string(),
            enabled: true,
        };

        // Test add
        db.add_command_repo(&repo).unwrap();

        // Test get all
        let repos = db.get_all_command_repos().unwrap();
        assert_eq!(repos.len(), 1);
        assert_eq!(repos[0].owner, "anthropics");
        assert!(repos[0].enabled);

        // Test update enabled
        db.update_command_repo_enabled("anthropics", "claude-commands", false)
            .unwrap();
        let repos = db.get_all_command_repos().unwrap();
        assert!(!repos[0].enabled);

        // Test remove
        db.remove_command_repo("anthropics", "claude-commands")
            .unwrap();
        let repos = db.get_all_command_repos().unwrap();
        assert!(repos.is_empty());
    }
}
