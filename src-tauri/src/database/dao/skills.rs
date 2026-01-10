//! Skills 数据访问对象
//!
//! 提供 Skills 和 Skill Repos 的 CRUD 操作。
//!
//! v3.10.0+ 统一管理架构：
//! - Skills 使用统一的 id 主键，支持三应用启用标志
//! - 实际文件存储在 ~/.cc-switch/skills/，同步到各应用目录

use crate::app_config::{InstalledSkill, SkillApps};
use crate::database::{lock_conn, Database};
use crate::error::AppError;
use crate::services::skill::SkillRepo;
use indexmap::IndexMap;
use rusqlite::params;

impl Database {
    // ========== InstalledSkill CRUD ==========

    /// 获取所有已安装的 Skills
    pub fn get_all_installed_skills(&self) -> Result<IndexMap<String, InstalledSkill>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, directory, namespace, repo_owner, repo_name, repo_branch,
                        readme_url, enabled_claude, enabled_codex, enabled_gemini, file_hash, installed_at,
                        scope, project_path
                 FROM skills ORDER BY namespace ASC, name ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let skill_iter = stmt
            .query_map([], |row| {
                Ok(InstalledSkill {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    directory: row.get(3)?,
                    namespace: row.get(4)?,
                    repo_owner: row.get(5)?,
                    repo_name: row.get(6)?,
                    repo_branch: row.get(7)?,
                    readme_url: row.get(8)?,
                    apps: SkillApps {
                        claude: row.get(9)?,
                        codex: row.get(10)?,
                        gemini: row.get(11)?,
                    },
                    file_hash: row.get(12)?,
                    installed_at: row.get(13)?,
                    scope: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "global".to_string()),
                    project_path: row.get(15)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut skills = IndexMap::new();
        for skill_res in skill_iter {
            let skill = skill_res.map_err(|e| AppError::Database(e.to_string()))?;
            skills.insert(skill.id.clone(), skill);
        }
        Ok(skills)
    }

    /// 获取单个已安装的 Skill
    pub fn get_installed_skill(&self, id: &str) -> Result<Option<InstalledSkill>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, directory, namespace, repo_owner, repo_name, repo_branch,
                        readme_url, enabled_claude, enabled_codex, enabled_gemini, file_hash, installed_at,
                        scope, project_path
                 FROM skills WHERE id = ?1",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let result = stmt.query_row([id], |row| {
            Ok(InstalledSkill {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                directory: row.get(3)?,
                namespace: row.get(4)?,
                repo_owner: row.get(5)?,
                repo_name: row.get(6)?,
                repo_branch: row.get(7)?,
                readme_url: row.get(8)?,
                apps: SkillApps {
                    claude: row.get(9)?,
                    codex: row.get(10)?,
                    gemini: row.get(11)?,
                },
                file_hash: row.get(12)?,
                installed_at: row.get(13)?,
                scope: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "global".to_string()),
                project_path: row.get(15)?,
            })
        });

        match result {
            Ok(skill) => Ok(Some(skill)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }

    /// 保存 Skill（添加或更新）
    pub fn save_skill(&self, skill: &InstalledSkill) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO skills
             (id, name, description, directory, namespace, repo_owner, repo_name, repo_branch,
              readme_url, enabled_claude, enabled_codex, enabled_gemini, file_hash, installed_at,
              scope, project_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                skill.id,
                skill.name,
                skill.description,
                skill.directory,
                skill.namespace,
                skill.repo_owner,
                skill.repo_name,
                skill.repo_branch,
                skill.readme_url,
                skill.apps.claude,
                skill.apps.codex,
                skill.apps.gemini,
                skill.file_hash,
                skill.installed_at,
                skill.scope,
                skill.project_path,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 删除 Skill
    pub fn delete_skill(&self, id: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute("DELETE FROM skills WHERE id = ?1", params![id])
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 清空所有 Skills（用于迁移）
    pub fn clear_skills(&self) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute("DELETE FROM skills", [])
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 更新 Skill 的应用启用状态
    pub fn update_skill_apps(&self, id: &str, apps: &SkillApps) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE skills SET enabled_claude = ?1, enabled_codex = ?2, enabled_gemini = ?3 WHERE id = ?4",
                params![apps.claude, apps.codex, apps.gemini, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 更新 Skill 的 file_hash（用于更新检测修复）
    pub fn update_skill_file_hash(
        &self,
        id: &str,
        file_hash: Option<&str>,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE skills SET file_hash = ?1 WHERE id = ?2",
                params![file_hash, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 更新 Skill 的安装范围
    pub fn update_skill_scope(
        &self,
        id: &str,
        scope: &str,
        project_path: Option<&str>,
    ) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let affected = conn
            .execute(
                "UPDATE skills SET scope = ?1, project_path = ?2 WHERE id = ?3",
                params![scope, project_path, id],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 获取所有命名空间列表
    pub fn get_skill_namespaces(&self) -> Result<Vec<String>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare("SELECT DISTINCT namespace FROM skills ORDER BY namespace ASC")
            .map_err(|e| AppError::Database(e.to_string()))?;

        let namespace_iter = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut namespaces = Vec::new();
        for ns_res in namespace_iter {
            namespaces.push(ns_res.map_err(|e| AppError::Database(e.to_string()))?);
        }
        Ok(namespaces)
    }

    /// 按命名空间获取 Skills
    pub fn get_skills_by_namespace(
        &self,
        namespace: &str,
    ) -> Result<Vec<InstalledSkill>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT id, name, description, directory, namespace, repo_owner, repo_name, repo_branch,
                        readme_url, enabled_claude, enabled_codex, enabled_gemini, file_hash, installed_at,
                        scope, project_path
                 FROM skills WHERE namespace = ?1 ORDER BY name ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let skill_iter = stmt
            .query_map([namespace], |row| {
                Ok(InstalledSkill {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    directory: row.get(3)?,
                    namespace: row.get(4)?,
                    repo_owner: row.get(5)?,
                    repo_name: row.get(6)?,
                    repo_branch: row.get(7)?,
                    readme_url: row.get(8)?,
                    apps: SkillApps {
                        claude: row.get(9)?,
                        codex: row.get(10)?,
                        gemini: row.get(11)?,
                    },
                    file_hash: row.get(12)?,
                    installed_at: row.get(13)?,
                    scope: row.get::<_, Option<String>>(14)?.unwrap_or_else(|| "global".to_string()),
                    project_path: row.get(15)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut skills = Vec::new();
        for skill_res in skill_iter {
            skills.push(skill_res.map_err(|e| AppError::Database(e.to_string()))?);
        }
        Ok(skills)
    }

    /// 检查命名空间是否为空
    pub fn is_namespace_empty(&self, namespace: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM skills WHERE namespace = ?1",
                params![namespace],
                |row| row.get(0),
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(count == 0)
    }

    // ========== SkillRepo CRUD（保持原有） ==========

    /// 获取所有 Skill 仓库（按 added_at 排序，内置仓库优先）
    pub fn get_skill_repos(&self) -> Result<Vec<SkillRepo>, AppError> {
        let conn = lock_conn!(self.conn);
        let mut stmt = conn
            .prepare(
                "SELECT owner, name, branch, enabled, builtin, description_zh, description_en, description_ja, added_at
                 FROM skill_repos ORDER BY added_at ASC, owner ASC, name ASC",
            )
            .map_err(|e| AppError::Database(e.to_string()))?;

        let repo_iter = stmt
            .query_map([], |row| {
                Ok(SkillRepo {
                    owner: row.get(0)?,
                    name: row.get(1)?,
                    branch: row.get(2)?,
                    enabled: row.get(3)?,
                    builtin: row.get(4)?,
                    description_zh: row.get(5)?,
                    description_en: row.get(6)?,
                    description_ja: row.get(7)?,
                    added_at: row.get(8)?,
                })
            })
            .map_err(|e| AppError::Database(e.to_string()))?;

        let mut repos = Vec::new();
        for repo_res in repo_iter {
            repos.push(repo_res.map_err(|e| AppError::Database(e.to_string()))?);
        }
        Ok(repos)
    }

    /// 保存 Skill 仓库
    pub fn save_skill_repo(&self, repo: &SkillRepo) -> Result<(), AppError> {
        let conn = lock_conn!(self.conn);
        conn.execute(
            "INSERT OR REPLACE INTO skill_repos (owner, name, branch, enabled, builtin, description_zh, description_en, description_ja, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                repo.owner,
                repo.name,
                repo.branch,
                repo.enabled,
                repo.builtin,
                repo.description_zh,
                repo.description_en,
                repo.description_ja,
                repo.added_at,
            ],
        )
        .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(())
    }

    /// 删除 Skill 仓库（不允许删除内置仓库）
    pub fn delete_skill_repo(&self, owner: &str, name: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        // 检查是否为内置仓库
        let is_builtin: bool = conn
            .query_row(
                "SELECT builtin FROM skill_repos WHERE owner = ?1 AND name = ?2",
                params![owner, name],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if is_builtin {
            return Err(AppError::Config("无法删除内置仓库".to_string()));
        }

        let affected = conn
            .execute(
                "DELETE FROM skill_repos WHERE owner = ?1 AND name = ?2",
                params![owner, name],
            )
            .map_err(|e| AppError::Database(e.to_string()))?;
        Ok(affected > 0)
    }

    /// 同步内置 Skill 仓库
    ///
    /// - 添加缺失的内置仓库
    /// - 更新已存在内置仓库的描述（但保留用户的 enabled 和 branch 设置）
    /// - 不删除用户自己添加的仓库
    pub fn sync_builtin_skill_repos(&self) -> Result<(usize, usize), AppError> {
        use crate::services::builtin_repos::get_builtin_skill_repos;

        let builtin_repos = get_builtin_skill_repos()?;
        let existing = self.get_skill_repos()?;

        // 构建现有仓库的 map
        let existing_map: std::collections::HashMap<(String, String), SkillRepo> = existing
            .into_iter()
            .map(|r| ((r.owner.clone(), r.name.clone()), r))
            .collect();

        let mut added = 0;
        let mut updated = 0;

        let conn = lock_conn!(self.conn);

        for builtin in builtin_repos {
            let key = (builtin.owner.clone(), builtin.name.clone());

            if let Some(existing_repo) = existing_map.get(&key) {
                // 仓库已存在，更新描述但保留用户设置
                conn.execute(
                    "UPDATE skill_repos SET builtin = 1, description_zh = ?1, description_en = ?2, description_ja = ?3
                     WHERE owner = ?4 AND name = ?5",
                    params![
                        builtin.description.zh,
                        builtin.description.en,
                        builtin.description.ja,
                        builtin.owner,
                        builtin.name,
                    ],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;

                // 只有当描述实际发生变化时才计入 updated
                if existing_repo.description_zh.as_deref() != Some(&builtin.description.zh)
                    || existing_repo.description_en.as_deref() != Some(&builtin.description.en)
                    || existing_repo.description_ja.as_deref() != Some(&builtin.description.ja)
                {
                    updated += 1;
                }
            } else {
                // 仓库不存在，添加新的内置仓库
                conn.execute(
                    "INSERT INTO skill_repos (owner, name, branch, enabled, builtin, description_zh, description_en, description_ja, added_at)
                     VALUES (?1, ?2, ?3, 1, 1, ?4, ?5, ?6, 0)",
                    params![
                        builtin.owner,
                        builtin.name,
                        builtin.branch,
                        builtin.description.zh,
                        builtin.description.en,
                        builtin.description.ja,
                    ],
                )
                .map_err(|e| AppError::Database(e.to_string()))?;
                added += 1;
            }
        }

        if added > 0 || updated > 0 {
            log::info!("同步内置 Skill 仓库完成：新增 {added} 个，更新 {updated} 个");
        }

        Ok((added, updated))
    }

    /// 恢复默认内置 Skill 仓库（仅添加缺失的内置仓库，不删除用户添加的）
    pub fn restore_builtin_skill_repos(&self) -> Result<usize, AppError> {
        let (added, _) = self.sync_builtin_skill_repos()?;
        Ok(added)
    }

    /// 检查仓库是否为内置仓库
    pub fn is_builtin_skill_repo(&self, owner: &str, name: &str) -> Result<bool, AppError> {
        let conn = lock_conn!(self.conn);
        let result: Result<bool, _> = conn.query_row(
            "SELECT builtin FROM skill_repos WHERE owner = ?1 AND name = ?2",
            params![owner, name],
            |row| row.get(0),
        );

        match result {
            Ok(builtin) => Ok(builtin),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
            Err(e) => Err(AppError::Database(e.to_string())),
        }
    }
}
