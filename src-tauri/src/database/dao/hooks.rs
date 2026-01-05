//! Hooks DAO - 数据访问对象
//!
//! 提供 hooks 表的 CRUD 操作

use crate::app_config::{
    DiscoverableHook, HookApps, HookEventType, HookNamespace, HookRule, InstalledHook,
};
use crate::database::{lock_conn, to_json_string, Database};
use crate::error::AppError;
use indexmap::IndexMap;
use rusqlite::{params, OptionalExtension};

/// Hook 发现缓存条目
#[derive(Debug, Clone)]
pub struct HookDiscoveryCache {
    pub repo_owner: String,
    pub repo_name: String,
    pub repo_branch: String,
    pub hooks: Vec<DiscoverableHook>,
    pub scanned_at: i64,
}

/// Hook 缓存过期时间（秒）- 与 Commands/Agents 共用同一常量
pub use super::commands::CACHE_EXPIRY_SECONDS;

impl Database {
    // ========== Hooks CRUD ==========

    /// 获取所有已安装的 Hooks
    pub fn get_all_installed_hooks(&self) -> Result<IndexMap<String, InstalledHook>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       event_type, rules_json,
                       enabled, priority,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM hooks
                ORDER BY priority, namespace, filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                let event_type_str: String = row.get(5)?;
                let rules_json: String = row.get(6)?;

                Ok(InstalledHook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    event_type: serde_json::from_str(&format!("\"{}\"", event_type_str))
                        .unwrap_or(HookEventType::PreToolUse),
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    enabled: row.get::<_, i32>(7)? != 0,
                    priority: row.get(8)?,
                    repo_owner: row.get(9)?,
                    repo_name: row.get(10)?,
                    repo_branch: row.get(11)?,
                    readme_url: row.get(12)?,
                    source_path: row.get(13)?,
                    apps: HookApps {
                        claude: row.get::<_, i32>(14)? != 0,
                        codex: row.get::<_, i32>(15)? != 0,
                        gemini: row.get::<_, i32>(16)? != 0,
                    },
                    file_hash: row.get(17)?,
                    installed_at: row.get(18)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut hooks = IndexMap::new();
        for row in rows {
            let hook = row.map_err(|e| AppError::Database(e.to_string()))?;
            hooks.insert(hook.id.clone(), hook);
        }

        Ok(hooks)
    }

    /// 获取单个 Hook
    pub fn get_installed_hook(&self, id: &str) -> Result<Option<InstalledHook>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       event_type, rules_json,
                       enabled, priority,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM hooks
                WHERE id = ?1
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![id], |row| {
                let event_type_str: String = row.get(5)?;
                let rules_json: String = row.get(6)?;

                Ok(InstalledHook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    event_type: serde_json::from_str(&format!("\"{}\"", event_type_str))
                        .unwrap_or(HookEventType::PreToolUse),
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    enabled: row.get::<_, i32>(7)? != 0,
                    priority: row.get(8)?,
                    repo_owner: row.get(9)?,
                    repo_name: row.get(10)?,
                    repo_branch: row.get(11)?,
                    readme_url: row.get(12)?,
                    source_path: row.get(13)?,
                    apps: HookApps {
                        claude: row.get::<_, i32>(14)? != 0,
                        codex: row.get::<_, i32>(15)? != 0,
                        gemini: row.get::<_, i32>(16)? != 0,
                    },
                    file_hash: row.get(17)?,
                    installed_at: row.get(18)?,
                })
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(result)
    }

    /// 保存 Hook（插入或更新）
    pub fn save_hook(&self, hook: &InstalledHook) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        let rules_json = to_json_string(&hook.rules)?;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO hooks (
                id, name, description, namespace, filename,
                event_type, rules_json,
                enabled, priority,
                repo_owner, repo_name, repo_branch, readme_url, source_path,
                enabled_claude, enabled_codex, enabled_gemini,
                file_hash, installed_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                hook.id,
                hook.name,
                hook.description,
                hook.namespace,
                hook.filename,
                hook.event_type.to_string(),
                rules_json,
                hook.enabled as i32,
                hook.priority,
                hook.repo_owner,
                hook.repo_name,
                hook.repo_branch,
                hook.readme_url,
                hook.source_path,
                hook.apps.claude as i32,
                hook.apps.codex as i32,
                hook.apps.gemini as i32,
                hook.file_hash,
                hook.installed_at,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除 Hook
    pub fn delete_hook(&self, id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM hooks WHERE id = ?1", params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Hook 的启用状态
    pub fn update_hook_enabled(&self, id: &str, enabled: bool) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE hooks SET enabled = ?1 WHERE id = ?2",
                params![enabled as i32, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 更新 Hook 的应用启用状态
    pub fn update_hook_apps(&self, id: &str, apps: &HookApps) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                UPDATE hooks
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

    /// 更新 Hook 的优先级
    pub fn update_hook_priority(&self, id: &str, priority: i32) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE hooks SET priority = ?1 WHERE id = ?2",
                params![priority, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 批量更新 Hook 优先级（用于拖拽排序）
    pub fn reorder_hooks(&self, ids: &[String]) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let mut count = 0;

        for (index, id) in ids.iter().enumerate() {
            let priority = (index + 1) as i32 * 10; // 间隔 10 便于插入
            let affected = conn
                .execute(
                    "UPDATE hooks SET priority = ?1 WHERE id = ?2",
                    params![priority, id],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
            count += affected;
        }

        Ok(count)
    }

    /// 更新 Hook 的文件哈希
    pub fn update_hook_hash(&self, id: &str, file_hash: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE hooks SET file_hash = ?1 WHERE id = ?2",
                params![file_hash, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 按命名空间获取 Hooks
    pub fn get_hooks_by_namespace(&self, namespace: &str) -> Result<Vec<InstalledHook>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT id, name, description, namespace, filename,
                       event_type, rules_json,
                       enabled, priority,
                       repo_owner, repo_name, repo_branch, readme_url, source_path,
                       enabled_claude, enabled_codex, enabled_gemini,
                       file_hash, installed_at
                FROM hooks
                WHERE namespace = ?1
                ORDER BY priority, filename
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map(params![namespace], |row| {
                let event_type_str: String = row.get(5)?;
                let rules_json: String = row.get(6)?;

                Ok(InstalledHook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    event_type: serde_json::from_str(&format!("\"{}\"", event_type_str))
                        .unwrap_or(HookEventType::PreToolUse),
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    enabled: row.get::<_, i32>(7)? != 0,
                    priority: row.get(8)?,
                    repo_owner: row.get(9)?,
                    repo_name: row.get(10)?,
                    repo_branch: row.get(11)?,
                    readme_url: row.get(12)?,
                    source_path: row.get(13)?,
                    apps: HookApps {
                        claude: row.get::<_, i32>(14)? != 0,
                        codex: row.get::<_, i32>(15)? != 0,
                        gemini: row.get::<_, i32>(16)? != 0,
                    },
                    file_hash: row.get(17)?,
                    installed_at: row.get(18)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut hooks = Vec::new();
        for row in rows {
            hooks.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(hooks)
    }

    /// 按事件类型获取已启用的 Hooks（用于生成应用配置）
    pub fn get_enabled_hooks_by_event(
        &self,
        event_type: &HookEventType,
        app: &str,
    ) -> Result<Vec<InstalledHook>, AppError> {
        let conn = lock_conn!(self.conn);

        // 根据应用类型构建查询条件
        let app_column = match app.to_lowercase().as_str() {
            "claude" => "enabled_claude",
            "codex" => "enabled_codex",
            "gemini" => "enabled_gemini",
            _ => return Ok(Vec::new()),
        };

        let query = format!(
            r#"
            SELECT id, name, description, namespace, filename,
                   event_type, rules_json,
                   enabled, priority,
                   repo_owner, repo_name, repo_branch, readme_url, source_path,
                   enabled_claude, enabled_codex, enabled_gemini,
                   file_hash, installed_at
            FROM hooks
            WHERE enabled = 1 AND {} = 1 AND event_type = ?1
            ORDER BY priority
            "#,
            app_column
        );

        let mut stmt = conn
            .prepare(&query)
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map(params![event_type.to_string()], |row| {
                let event_type_str: String = row.get(5)?;
                let rules_json: String = row.get(6)?;

                Ok(InstalledHook {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    namespace: row.get(3)?,
                    filename: row.get(4)?,
                    event_type: serde_json::from_str(&format!("\"{}\"", event_type_str))
                        .unwrap_or(HookEventType::PreToolUse),
                    rules: serde_json::from_str(&rules_json).unwrap_or_default(),
                    enabled: row.get::<_, i32>(7)? != 0,
                    priority: row.get(8)?,
                    repo_owner: row.get(9)?,
                    repo_name: row.get(10)?,
                    repo_branch: row.get(11)?,
                    readme_url: row.get(12)?,
                    source_path: row.get(13)?,
                    apps: HookApps {
                        claude: row.get::<_, i32>(14)? != 0,
                        codex: row.get::<_, i32>(15)? != 0,
                        gemini: row.get::<_, i32>(16)? != 0,
                    },
                    file_hash: row.get(17)?,
                    installed_at: row.get(18)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut hooks = Vec::new();
        for row in rows {
            hooks.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(hooks)
    }

    /// 获取所有命名空间及其 Hook 数量
    pub fn get_hook_namespaces(&self) -> Result<Vec<HookNamespace>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT namespace, COUNT(*) as count
                FROM hooks
                GROUP BY namespace
                ORDER BY namespace
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let rows = stmt
            .query_map([], |row| {
                let namespace: String = row.get(0)?;
                let count: i64 = row.get(1)?;
                Ok(HookNamespace {
                    name: namespace.clone(),
                    display_name: if namespace.is_empty() {
                        "Root".to_string()
                    } else {
                        namespace
                    },
                    hook_count: count as usize,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut namespaces = Vec::new();
        for row in rows {
            namespaces.push(row.map_err(|e| AppError::Database(e.to_string()))?);
        }

        Ok(namespaces)
    }

    /// 检查 hooks 表是否为空
    pub fn is_hooks_table_empty(&self) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM hooks", [], |row| row.get(0))
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(count == 0)
    }

    // ========== Hook Discovery Cache ==========

    /// 获取仓库的缓存 Hooks（如果未过期）
    ///
    /// 返回 None 如果缓存不存在或已过期
    pub fn get_cached_hooks(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<Option<HookDiscoveryCache>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                r#"
                SELECT repo_owner, repo_name, repo_branch, hooks_json, scanned_at
                FROM hook_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt
            .query_row(params![owner, name, branch], |row| {
                let hooks_json: String = row.get(3)?;
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
                let hooks: Vec<DiscoverableHook> =
                    serde_json::from_str(&hooks_json).unwrap_or_default();

                Ok(Some(HookDiscoveryCache {
                    repo_owner: row.get(0)?,
                    repo_name: row.get(1)?,
                    repo_branch: row.get(2)?,
                    hooks,
                    scanned_at,
                }))
            })
            .optional()
            .map_err(|e| AppError::Database(e.to_string()))?;

        // 展平 Option<Option<T>> -> Option<T>
        Ok(result.flatten())
    }

    /// 保存 Hooks 到缓存
    pub fn save_cached_hooks(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
        hooks: &[DiscoverableHook],
    ) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        let hooks_json = to_json_string(hooks)?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        conn.execute(
            r#"
            INSERT OR REPLACE INTO hook_discovery_cache
                (repo_owner, repo_name, repo_branch, hooks_json, scanned_at)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![owner, name, branch, hooks_json, now],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(())
    }

    /// 删除指定仓库的 Hook 缓存
    pub fn delete_cached_hooks(
        &self,
        owner: &str,
        name: &str,
        branch: &str,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                r#"
                DELETE FROM hook_discovery_cache
                WHERE repo_owner = ?1 AND repo_name = ?2 AND repo_branch = ?3
                "#,
                params![owner, name, branch],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected > 0)
    }

    /// 删除指定仓库的所有分支 Hook 缓存
    pub fn delete_hook_repo_cache(&self, owner: &str, name: &str) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "DELETE FROM hook_discovery_cache WHERE repo_owner = ?1 AND repo_name = ?2",
                params![owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清空所有 Hook 缓存
    pub fn clear_all_hook_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM hook_discovery_cache", [])
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }

    /// 清理过期的 Hook 缓存条目
    pub fn cleanup_expired_hook_cache(&self) -> Result<usize, AppError> {
        let conn = lock_conn!(self.conn);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let cutoff = now - CACHE_EXPIRY_SECONDS;

        let affected = conn
            .execute(
                "DELETE FROM hook_discovery_cache WHERE scanned_at < ?1",
                params![cutoff],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        Ok(affected)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_config::HookType;

    fn create_test_hook(id: &str, namespace: &str, filename: &str) -> InstalledHook {
        InstalledHook {
            id: id.to_string(),
            name: format!("Test Hook {}", filename),
            description: Some("A test hook".to_string()),
            namespace: namespace.to_string(),
            filename: filename.to_string(),
            event_type: HookEventType::PreToolUse,
            rules: vec![HookRule {
                matcher: "Bash".to_string(),
                hooks: vec![HookType::Command {
                    command: "/usr/bin/test-hook".to_string(),
                }],
            }],
            enabled: true,
            priority: 100,
            repo_owner: Some("test-owner".to_string()),
            repo_name: Some("test-repo".to_string()),
            repo_branch: Some("main".to_string()),
            readme_url: None,
            source_path: Some(format!("hooks/{}.json", filename)),
            apps: HookApps {
                claude: true,
                codex: false,
                gemini: false,
            },
            file_hash: Some("abc123".to_string()),
            installed_at: 1700000000,
        }
    }

    #[test]
    fn test_hook_crud() {
        let db = Database::memory().unwrap();

        // Test save and get
        let hook = create_test_hook("security/pre-bash-check", "security", "pre-bash-check");
        db.save_hook(&hook).unwrap();

        let retrieved = db.get_installed_hook("security/pre-bash-check").unwrap();
        assert!(retrieved.is_some());
        let retrieved = retrieved.unwrap();
        assert_eq!(retrieved.id, "security/pre-bash-check");
        assert_eq!(retrieved.namespace, "security");
        assert_eq!(retrieved.filename, "pre-bash-check");
        assert!(retrieved.apps.claude);
        assert!(!retrieved.apps.codex);
        assert_eq!(retrieved.event_type, HookEventType::PreToolUse);
        assert_eq!(retrieved.priority, 100);

        // Test get all
        let all = db.get_all_installed_hooks().unwrap();
        assert_eq!(all.len(), 1);

        // Test update enabled
        db.update_hook_enabled("security/pre-bash-check", false)
            .unwrap();
        let updated = db
            .get_installed_hook("security/pre-bash-check")
            .unwrap()
            .unwrap();
        assert!(!updated.enabled);

        // Test update apps
        let new_apps = HookApps {
            claude: true,
            codex: true,
            gemini: false,
        };
        db.update_hook_apps("security/pre-bash-check", &new_apps)
            .unwrap();
        let updated = db
            .get_installed_hook("security/pre-bash-check")
            .unwrap()
            .unwrap();
        assert!(updated.apps.codex);

        // Test update priority
        db.update_hook_priority("security/pre-bash-check", 50)
            .unwrap();
        let updated = db
            .get_installed_hook("security/pre-bash-check")
            .unwrap()
            .unwrap();
        assert_eq!(updated.priority, 50);

        // Test delete
        let deleted = db.delete_hook("security/pre-bash-check").unwrap();
        assert!(deleted);

        let retrieved = db.get_installed_hook("security/pre-bash-check").unwrap();
        assert!(retrieved.is_none());
    }

    #[test]
    fn test_hook_namespaces() {
        let db = Database::memory().unwrap();

        // Add hooks in different namespaces
        let hook1 = create_test_hook("security/hook1", "security", "hook1");
        let hook2 = create_test_hook("security/hook2", "security", "hook2");
        let hook3 = create_test_hook("logging/hook3", "logging", "hook3");
        let mut hook4 = create_test_hook("hook4", "", "hook4"); // root namespace
        hook4.namespace = "".to_string();
        hook4.id = "hook4".to_string();

        db.save_hook(&hook1).unwrap();
        db.save_hook(&hook2).unwrap();
        db.save_hook(&hook3).unwrap();
        db.save_hook(&hook4).unwrap();

        let namespaces = db.get_hook_namespaces().unwrap();
        assert_eq!(namespaces.len(), 3); // "", "logging", "security"

        // Test get by namespace
        let security_hooks = db.get_hooks_by_namespace("security").unwrap();
        assert_eq!(security_hooks.len(), 2);

        let root_hooks = db.get_hooks_by_namespace("").unwrap();
        assert_eq!(root_hooks.len(), 1);
    }

    #[test]
    fn test_reorder_hooks() {
        let db = Database::memory().unwrap();

        // Add multiple hooks
        let mut hook1 = create_test_hook("hook1", "", "hook1");
        hook1.id = "hook1".to_string();
        hook1.priority = 100;

        let mut hook2 = create_test_hook("hook2", "", "hook2");
        hook2.id = "hook2".to_string();
        hook2.priority = 200;

        let mut hook3 = create_test_hook("hook3", "", "hook3");
        hook3.id = "hook3".to_string();
        hook3.priority = 300;

        db.save_hook(&hook1).unwrap();
        db.save_hook(&hook2).unwrap();
        db.save_hook(&hook3).unwrap();

        // Reorder: hook3 -> hook1 -> hook2
        let new_order = vec!["hook3".to_string(), "hook1".to_string(), "hook2".to_string()];
        db.reorder_hooks(&new_order).unwrap();

        let hook3_updated = db.get_installed_hook("hook3").unwrap().unwrap();
        let hook1_updated = db.get_installed_hook("hook1").unwrap().unwrap();
        let hook2_updated = db.get_installed_hook("hook2").unwrap().unwrap();

        assert_eq!(hook3_updated.priority, 10);
        assert_eq!(hook1_updated.priority, 20);
        assert_eq!(hook2_updated.priority, 30);
    }
}
