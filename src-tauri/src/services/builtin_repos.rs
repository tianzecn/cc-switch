//! 内置仓库配置模块
//!
//! 提供内置仓库的加载、同步和管理功能。
//! 内置仓库从 `resources/builtin-repos.json` 加载，支持多语言描述。

use crate::error::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// 多语言描述
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalizedDescription {
    pub zh: String,
    pub en: String,
    pub ja: String,
}

impl LocalizedDescription {
    /// 根据语言代码获取描述
    pub fn get(&self, lang: &str) -> &str {
        match lang {
            "zh" | "zh-CN" | "zh-TW" => &self.zh,
            "ja" | "ja-JP" => &self.ja,
            _ => &self.en, // 默认英文
        }
    }
}

/// 内置仓库配置项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuiltinRepoConfig {
    pub owner: String,
    pub name: String,
    pub branch: String,
    pub description: LocalizedDescription,
}

/// 内置仓库配置文件结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuiltinReposConfig {
    pub version: u32,
    pub skills: Vec<BuiltinRepoConfig>,
    pub commands: Vec<BuiltinRepoConfig>,
}

/// 扩展的仓库信息（包含内置标记和描述）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoWithMeta {
    pub owner: String,
    pub name: String,
    pub branch: String,
    pub enabled: bool,
    pub builtin: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_zh: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_en: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description_ja: Option<String>,
    pub added_at: i64,
}

/// 恢复默认仓库的结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    pub restored_count: u32,
    pub message: String,
}

/// 获取内置仓库配置文件的路径
fn get_builtin_repos_path() -> Result<PathBuf, AppError> {
    // 开发环境：直接从 src-tauri/resources 目录读取
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/builtin-repos.json");
    if dev_path.exists() {
        return Ok(dev_path);
    }

    // 生产环境：从应用资源目录读取
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(bundle_path) = exe_path
                .parent() // MacOS
                .and_then(|p| p.parent()) // Contents
                .and_then(|p| p.parent()) // .app
            {
                let resource_path =
                    bundle_path.join("Contents/Resources/resources/builtin-repos.json");
                if resource_path.exists() {
                    return Ok(resource_path);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let resource_path = exe_dir.join("resources/builtin-repos.json");
                if resource_path.exists() {
                    return Ok(resource_path);
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(exe_path) = std::env::current_exe() {
            if let Some(exe_dir) = exe_path.parent() {
                let resource_path = exe_dir.join("resources/builtin-repos.json");
                if resource_path.exists() {
                    return Ok(resource_path);
                }
            }
        }
    }

    // 最后回退到开发路径
    Ok(dev_path)
}

/// 加载内置仓库配置
pub fn load_builtin_repos() -> Result<BuiltinReposConfig, AppError> {
    let path = get_builtin_repos_path()?;

    if !path.exists() {
        log::warn!("内置仓库配置文件不存在: {:?}，使用空配置", path);
        return Ok(BuiltinReposConfig {
            version: 1,
            skills: vec![],
            commands: vec![],
        });
    }

    let content = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Config(format!("读取内置仓库配置失败: {e}")))?;

    serde_json::from_str(&content)
        .map_err(|e| AppError::Config(format!("解析内置仓库配置失败: {e}")))
}

/// 获取内置 Skills 仓库列表
pub fn get_builtin_skill_repos() -> Result<Vec<BuiltinRepoConfig>, AppError> {
    let config = load_builtin_repos()?;
    Ok(config.skills)
}

/// 获取内置 Commands 仓库列表
pub fn get_builtin_command_repos() -> Result<Vec<BuiltinRepoConfig>, AppError> {
    let config = load_builtin_repos()?;
    Ok(config.commands)
}

/// 检查仓库是否为内置仓库
pub fn is_builtin_skill_repo(owner: &str, name: &str) -> Result<bool, AppError> {
    let builtin_repos = get_builtin_skill_repos()?;
    Ok(builtin_repos
        .iter()
        .any(|r| r.owner == owner && r.name == name))
}

/// 检查仓库是否为内置 Command 仓库
pub fn is_builtin_command_repo(owner: &str, name: &str) -> Result<bool, AppError> {
    let builtin_repos = get_builtin_command_repos()?;
    Ok(builtin_repos
        .iter()
        .any(|r| r.owner == owner && r.name == name))
}

/// 将内置仓库配置转换为 HashMap，方便查找
pub fn builtin_skill_repos_map() -> Result<HashMap<(String, String), BuiltinRepoConfig>, AppError> {
    let builtin_repos = get_builtin_skill_repos()?;
    let mut map = HashMap::new();
    for repo in builtin_repos {
        map.insert((repo.owner.clone(), repo.name.clone()), repo);
    }
    Ok(map)
}

/// 将内置 Command 仓库配置转换为 HashMap，方便查找
pub fn builtin_command_repos_map() -> Result<HashMap<(String, String), BuiltinRepoConfig>, AppError>
{
    let builtin_repos = get_builtin_command_repos()?;
    let mut map = HashMap::new();
    for repo in builtin_repos {
        map.insert((repo.owner.clone(), repo.name.clone()), repo);
    }
    Ok(map)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_builtin_repos() {
        let config = load_builtin_repos().unwrap();
        assert!(config.version >= 1);
        // 检查是否有 skills 和 commands
        println!("Skills: {:?}", config.skills.len());
        println!("Commands: {:?}", config.commands.len());
    }

    #[test]
    fn test_localized_description() {
        let desc = LocalizedDescription {
            zh: "中文".to_string(),
            en: "English".to_string(),
            ja: "日本語".to_string(),
        };

        assert_eq!(desc.get("zh"), "中文");
        assert_eq!(desc.get("zh-CN"), "中文");
        assert_eq!(desc.get("en"), "English");
        assert_eq!(desc.get("ja"), "日本語");
        assert_eq!(desc.get("fr"), "English"); // 默认英文
    }
}
