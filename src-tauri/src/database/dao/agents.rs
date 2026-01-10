//! Agents DAO - 数据访问对象
//!
//! 提供 agents 表的 CRUD 操作

use crate::app_config::{AgentApps, AgentNamespace, DiscoverableAgent, InstalledAgent};
use crate::database::{lock_conn, to_json_string, Database};
use crate::error::AppError;
use indexmap::IndexMap;
use rusqlite::{params, OptionalExtension};

/// Agent 发现缓存条目
#[derive(Debug, Clone)]
pub struct AgentDiscoveryCache {
    pub repo_owner: String,
    pub repo_name: String,
    pub repo_branch: String,
    pub agents: Vec<DiscoverableAgent>,
    pub scanned_at: i64,
}

/// Agent 缓存过期时间（秒）- 与 Commands 共用同一常量
pub use super::commands::CACHE_EXPIRY_SECONDS;

impl Database {
    // ========== Agents CRUD ==========

    /// 获取所有已安装的 Agents
    pub fn get_all_installed_agents(&self) -> Result<IndexMap<String, InstalledAgent>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       model, tools, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at, scope, project_path
                FROM agents
                ORDER BY namespace, filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(InstalledAgent {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    model: row.get(5)?,
                    tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(8)?,
                    repo_name: row.get(9)?,
                    repo_branch: row.get(10)?,
                    readme_url: row.get(11)?,
                    source_path: row.get(12)?,
                    apps: AgentApps {
                        claude: row.get::<_, i32>(13)? != 0,
                        codex: row.get::<_, i32>(14)? != 0,
                        gemini: row.get::<_, i32>(15)? != 0,
                    },
                    file_hash: row.get(16)?,
                    installed_at: row.get(17)?,
                    scope: row.get::<_, Option<String>>(18)?.unwrap_or_else(|| "global".to_string()),
                    project_path: row.get(19)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut agents = IndexMap::new();
        for row in rows {
            let agent = row.map_err(|e| AppError::Database(e.to_string()))?;
            agents.insert(agent.id.clone(), agent);
        }

        Ok(agents)
    }

    /// 获取单个 Agent
    pub fn get_installed_agent(&self, id: &str) -> Result<Option<InstalledAgent>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       model, tools, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at, scope, project_path
                FROM agents
                WHERE id = ?1
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![id], |row| {
                Ok(InstalledAgent {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    model: row.get(5)?,
                    tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(8)?,
                    repo_name: row.get(9)?,
                    repo_branch: row.get(10)?,
                    readme_url: row.get(11)?,
                    source_path: row.get(12)?,
                    apps: AgentApps {
                        claude: row.get::<_, i32>(13)? != 0,
                        codex: row.get::<_, i32>(14)? != 0,
                        gemini: row.get::<_, i32>(15)? != 0,
                    },
                    file_hash: row.get(16)?,
                    installed_at: row.get(17)?,
                    scope: row.get::<_, Option<String>>(18)?.unwrap_or_else(|| "global".to_string()),
                    project_path: row.get(19)?,
                })
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(result)
    }

    /// 保存 Agent（插入或更新）
    pub fn save_agent(&self, agent: &InstalledAgent) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            r#"
            INSERT OR REPLACE INTO agents (
                id, name, description, namespace, filename,
                model, tools, extra_metadata,
                repo_owner, repo_name, repo_branch, readme_url, source_path,
                enabled_claude, enabled_codex, enabled_gemini,
                file_hash, installed_at, scope, project_path
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
            "#,
            params![
                agent.id,
                agent.name,
                agent.description,
                agent.namespace,
                agent.filename,
                agent.model,
                agent.tools.as_ref().map(|v| to_json_string(v)).transpose()?,
                agent.extra_metadata.as_ref().map(|v| to_json_string(v)).transpose()?,
                agent.repo_owner,
                agent.repo_name,
                agent.repo_branch,
                agent.readme_url,
                agent.source_path,
                agent.apps.claude as i32,
                agent.apps.codex as i32,
                agent.apps.gemini as i32,
                agent.file_hash,
                agent.installed_at,
                agent.scope,
                agent.project_path,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除 Agent
    pub fn delete_agent(&self, id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM agents WHERE id = ?1", params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Agent 的应用启用状态
    pub fn update_agent_apps(&self, id: &str, apps: &AgentApps) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                UPDATE agents
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

    /// 更新 Agent 的安装范围
    pub fn update_agent_scope(
        &self,
        id: &str,
        scope: &str,
        project_path: Option<&str>,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE agents SET scope = ?1, project_path = ?2 WHERE id = ?3",
                params![scope, project_path, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 更新 Agent 的文件哈希
    pub fn update_agent_hash(&self, id: &str, file_hash: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE agents SET file_hash = ?1 WHERE id = ?2",
                params![file_hash, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 按命名空间获取 Agents
    pub fn get_agents_by_namespace(
        &self,
        namespace: &str,
    ) -> Result<Vec<InstalledAgent>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       model, tools, extra_metadata,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at, scope, project_path
                FROM agents
                WHERE namespace = ?1
                ORDER BY filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map(params![namespace], |row| {
                Ok(InstalledAgent {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    model: row.get(5)?,
                    tools: row
                        .get::<_, Option<String>>(6)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    extra_metadata: row
                        .get::<_, Option<String>>(7)?
                        .and_then(|s| serde_json::from_str(&s).ok()),
                    repo_owner: row.get(8)?,
                    repo_name: row.get(9)?,
                    repo_branch: row.get(10)?,
                    readme_url: row.get(11)?,
                    source_path: row.get(12)?,
                    apps: AgentApps {
                        claude: row.get::<_, i32>(13)? != 0,
                        codex: row.get::<_, i32>(14)? != 0,
                        gemini: row.get::<_, i32>(15)? != 0,
                    },
                    file_hash: row.get(16)?,
                    installed_at: row.get(17)?,
                    scope: row.get::<_, Option<String>>(18)?.unwrap_or_else(|| "global".to_string()),
                    project_path: row.get(19)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut agents = Vec::new();
        for row in rows {
            agents.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(agents)
    }

    /// 获取所有命名空间及其 Agent 数量
    pub fn get_agent_namespaces(&self) -> Result<Vec<AgentNamespace>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT namespace, COUNT(*) as count
                FROM agents
                GROUP BY namespace
                ORDER BY namespace
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                let namespace: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok(AgentNamespace {
                    name: namespace.clone(),
                    display_name: if namespace.is_empty() {
                        "Root".to_string()
                    } else {
                        namespace
                    },
                    agent_count: count as usize,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut namespaces = Vec::new();
        for row in rows {
            namespaces.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(namespaces)
    }

    /// 检查 agents 表是否为空
    pub fn is_agents_table_empty(&self) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM agents", [], |row| row.get(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(count == 0)
    }

    // ========== Agent Discovery Cache ==========

    /// 获取仓库的缓存 Agents（如果未过期）
    ///
    /// 返回 None 如果缓存不存在或已过期
    pub fn get_cached_agents(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<Option<AgentDiscoveryCache>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT repo_owner, repo_name, repo_branch, agents_json, scanned_at
                FROM agent_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![owner, name, branch], |row| {
                let agents_json: String = row.get(3)?;
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
                let agents: Vec<DiscoverableAgent> =
                    serde_json::from_str(&agents_json).unwrap_or_default();

                Ok(Some(AgentDiscoveryCache {
                    repo_owner: row.get(0)?,
                    repo_name: row.get(1)?,
                    repo_branch: row.get(2)?,
                    agents,
                    scanned_at,
                }))
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        // 展平 Option<Option<T>> -> Option<T>
        Ok(result.flatten())
    }

    /// 保存 Agents 到缓存
    pub fn save_cached_agents(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
        agents: &[DiscoverableAgent],
    ) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        let agents_json = to_json_string(agents)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO agent_discovery_cache
                (repo_owner, repo_name, repo_branch, agents_json, scanned_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![owner, name, branch, agents_json, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除指定仓库的 Agent 缓存
    pub fn delete_cached_agents(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                DELETE FROM agent_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
                params![owner, name, branch],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 删除指定仓库的所有分支 Agent 缓存
    pub fn delete_agent_repo_cache(&self, owner: &str, name: &str) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM agent_discovery_cache WHERE repo_owner = ?1 AND repo_name = ?2",
                params![owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清空所有 Agent 缓存
    pub fn clear_all_agent_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM agent_discovery_cache", [])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清理过期的 Agent 缓存条目
    pub fn cleanup_expired_agent_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let cutoff = now - CACHE_EXPIRY_SECONDS;

        let affected = conn
            .execute(
                "DELETE FROM agent_discovery_cache WHERE scanned_at < ?1",
                params![cutoff],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_agent(id: &str, namespace: &str, filename: &str) -> InstalledAgent {
        InstalledAgent {
            id: id.to_string(),
            name: format!("Test Agent {}", filename),
            description: Some("A test agent".to_string()),
            namespace: namespace.to_string(),
            filename: filename.to_string(),
            model: Some("sonnet".to_string()),
            tools: Some(vec!["Read".to_string(), "Write".to_string()]),
            extra_metadata: None,
            repo_owner: Some("test-owner".to_string()),
            repo_name: Some("test-repo".to_string()),
            repo_branch: Some("main".to_string()),
            readme_url: None,
            source_path: Some(format!("agents/{}.md", filename)),
            apps: AgentApps {
                claude: true,
                codex: false,
                gemini: false,
            },
            file_hash: Some("abc123".to_string()),
            installed_at: 1700000000,
        }
    }

    #[test]
    fn test_agent_crud() {
        let db = Database::memory().unwrap();

        // Test save and get
        let agent = create_test_agent("development/code-reviewer", "development", "code-reviewer");
        db.save_agent(&agent).unwrap();

        let retrieved = db.get_installed_agent("development/code-reviewer").unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, "development/code-reviewer");
        assert_eq!(retrieved.namespace, "development");
        assert_eq!(retrieved.filename, "code-reviewer");
        assert!(retrieved.apps.claude);
        assert!(!retrieved.apps.codex);
        assert_eq!(retrieved.model, Some("sonnet".to_string()));

        // Test get all
        let all = db.get_all_installed_agents().unwrap();
        assert_eq!(all.len(), 1);

        // Test update apps
        let new_apps = AgentApps {
            claude: true,
            codex: true,
            gemini: false,
        };
        db.update_agent_apps("development/code-reviewer", &new_apps).unwrap();
        let updated = db.get_installed_agent("development/code-reviewer").unwrap().unwrap();
        assert!(updated.apps.codex);

        // Test delete
        let deleted = db.delete_agent("development/code-reviewer").unwrap();
        assert!(deleted);
        let after_delete = db.get_installed_agent("development/code-reviewer").unwrap();
        assert!(after_delete.is_none());
    }

    #[test]
    fn test_agents_by_namespace() {
        let db = Database::memory().unwrap();

        // Add agents in different namespaces
        db.save_agent(&create_test_agent("debugger", "", "debugger"))
            .unwrap();
        db.save_agent(&create_test_agent("development/code-reviewer", "development", "code-reviewer"))
            .unwrap();
        db.save_agent(&create_test_agent("development/tdd-master", "development", "tdd-master"))
            .unwrap();
        db.save_agent(&create_test_agent("testing/unit-tester", "testing", "unit-tester"))
            .unwrap();

        // Test get by namespace
        let root_agents = db.get_agents_by_namespace("").unwrap();
        assert_eq!(root_agents.len(), 1);

        let dev_agents = db.get_agents_by_namespace("development").unwrap();
        assert_eq!(dev_agents.len(), 2);

        // Test get namespaces
        let namespaces = db.get_agent_namespaces().unwrap();
        assert_eq!(namespaces.len(), 3); // "", "development", "testing"

        // Find the root namespace
        let root_ns = namespaces.iter().find(|ns| ns.name.is_empty());
        assert!(root_ns.is_some());
        assert_eq!(root_ns.unwrap().display_name, "Root");
        assert_eq!(root_ns.unwrap().agent_count, 1);
    }

    #[test]
    fn test_agent_discovery_cache() {
        let db = Database::memory().unwrap();

        let agents = vec![
            DiscoverableAgent {
                key: "debugger".to_string(),
                name: "Debugger".to_string(),
                description: "Debug your code".to_string(),
                namespace: "".to_string(),
                filename: "debugger".to_string(),
                model: Some("sonnet".to_string()),
                tools: Some(vec!["Read".to_string()]),
                readme_url: None,
                repo_owner: "test".to_string(),
                repo_name: "agents".to_string(),
                repo_branch: "main".to_string(),
                source_path: Some("agents/debugger.md".to_string()),
            },
        ];

        // Test save cache
        db.save_cached_agents("test", "agents", "main", &agents).unwrap();

        // Test get cache (should exist and not expired)
        let cached = db.get_cached_agents("test", "agents", "main").unwrap();
        assert!(cached.is_some());
        let cached = cached.unwrap();
        assert_eq!(cached.agents.len(), 1);
        assert_eq!(cached.agents[0].key, "debugger");

        // Test delete cache
        let deleted = db.delete_cached_agents("test", "agents", "main").unwrap();
        assert!(deleted);

        let after_delete = db.get_cached_agents("test", "agents", "main").unwrap();
        assert!(after_delete.is_none());
    }
}
