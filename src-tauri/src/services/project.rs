//! Project 服务层
//!
//! 提供 Claude Code 项目的自动发现和管理功能：
//! - 从 `~/.claude/projects/` 目录读取项目列表
//! - 解析 jsonl 文件中的 cwd 字段获取真实路径
//! - 验证项目路径有效性
//! - 按最后使用时间排序

use anyhow::{Context, Result};
use chrono::{DateTime, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

// ========== 数据结构 ==========

/// 项目信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    /// 项目完整路径
    pub path: PathBuf,
    /// 项目名称（目录名）
    pub name: String,
    /// 最后使用时间（ISO 8601 格式）
    pub last_used: Option<DateTime<Utc>>,
    /// 路径是否有效（目录存在）
    pub is_valid: bool,
}

// ========== 服务实现 ==========

pub struct ProjectService;

impl ProjectService {
    /// 获取所有 Claude Code 项目
    ///
    /// 从 `~/.claude/projects/` 目录扫描所有项目，
    /// 解析 jsonl 文件获取真实路径，按最后使用时间排序
    pub fn get_all_projects() -> Result<Vec<ProjectInfo>> {
        let projects_dir = Self::get_projects_dir()?;

        if !projects_dir.exists() {
            return Ok(Vec::new());
        }

        let mut projects = Vec::new();

        for entry in fs::read_dir(&projects_dir)? {
            let entry = entry?;
            let path = entry.path();

            // 只处理以 '-' 开头的目录（编码的项目路径）
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name.starts_with('-') {
                        if let Some(project) = Self::parse_project_dir(&path) {
                            // 过滤掉 ~/.claude 本身（配置目录，不是项目）
                            if !Self::is_claude_config_dir(&project.path) {
                                projects.push(project);
                            }
                        }
                    }
                }
            }
        }

        // 按最近使用时间降序排序
        projects.sort_by(|a, b| {
            let a_time = a.last_used.unwrap_or(DateTime::<Utc>::MIN_UTC);
            let b_time = b.last_used.unwrap_or(DateTime::<Utc>::MIN_UTC);
            b_time.cmp(&a_time)
        });

        Ok(projects)
    }

    /// 获取 Claude Code 项目目录
    fn get_projects_dir() -> Result<PathBuf> {
        let home = dirs::home_dir().context("无法获取用户主目录")?;
        Ok(home.join(".claude").join("projects"))
    }

    /// 检查路径是否是 ~/.claude 配置目录
    fn is_claude_config_dir(path: &Path) -> bool {
        if let Some(home) = dirs::home_dir() {
            let claude_dir = home.join(".claude");
            path == claude_dir
        } else {
            false
        }
    }

    /// 解析项目目录，提取项目信息
    fn parse_project_dir(dir: &Path) -> Option<ProjectInfo> {
        let mut cwd: Option<String> = None;
        let mut last_used: Option<SystemTime> = None;

        // 遍历目录下的 jsonl 文件
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();

                // 只处理 .jsonl 文件
                if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
                    // 更新最后使用时间（取最新的文件修改时间）
                    if let Ok(metadata) = path.metadata() {
                        if let Ok(mtime) = metadata.modified() {
                            if last_used.is_none() || Some(mtime) > last_used {
                                last_used = Some(mtime);
                            }
                        }
                    }

                    // 如果还没找到 cwd，尝试从这个文件读取
                    if cwd.is_none() {
                        cwd = Self::read_cwd_from_jsonl(&path);
                    }
                }
            }
        }

        // 如果找到了 cwd，构建项目信息
        let cwd = cwd?;
        let project_path = PathBuf::from(&cwd);
        let name = project_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let is_valid = project_path.exists();

        // 转换 SystemTime 到 DateTime<Utc>
        let last_used_dt = last_used.and_then(|st| {
            st.duration_since(SystemTime::UNIX_EPOCH)
                .ok()
                .and_then(|d| Utc.timestamp_opt(d.as_secs() as i64, d.subsec_nanos()).single())
        });

        Some(ProjectInfo {
            path: project_path,
            name,
            last_used: last_used_dt,
            is_valid,
        })
    }

    /// 从 jsonl 文件读取 cwd 字段
    fn read_cwd_from_jsonl(path: &Path) -> Option<String> {
        let content = fs::read_to_string(path).ok()?;

        // jsonl 文件每行是一个 JSON 对象，找第一个包含 cwd 的
        for line in content.lines() {
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(json) = serde_json::from_str::<Value>(line) {
                if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                    return Some(cwd.to_string());
                }
            }
        }

        None
    }

    /// 检查项目路径是否有效
    pub fn is_project_valid(path: &Path) -> bool {
        path.exists() && path.is_dir()
    }

    /// 确保项目的 .claude 目录存在
    ///
    /// 如果不存在，自动创建 .claude 目录及子目录
    pub fn ensure_project_claude_dir(project_path: &Path) -> Result<PathBuf> {
        let claude_dir = project_path.join(".claude");

        if !claude_dir.exists() {
            fs::create_dir_all(&claude_dir)
                .with_context(|| format!("无法创建目录: {:?}", claude_dir))?;
        }

        Ok(claude_dir)
    }

    /// 获取项目的资源安装目录
    ///
    /// 例如：`<project>/.claude/skills/`
    pub fn get_project_resource_dir(project_path: &Path, resource_type: &str) -> Result<PathBuf> {
        let claude_dir = Self::ensure_project_claude_dir(project_path)?;
        let resource_dir = claude_dir.join(resource_type);

        if !resource_dir.exists() {
            fs::create_dir_all(&resource_dir)
                .with_context(|| format!("无法创建目录: {:?}", resource_dir))?;
        }

        Ok(resource_dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_claude_config_dir() {
        if let Some(home) = dirs::home_dir() {
            let claude_dir = home.join(".claude");
            assert!(ProjectService::is_claude_config_dir(&claude_dir));

            let other_dir = home.join("some-project");
            assert!(!ProjectService::is_claude_config_dir(&other_dir));
        }
    }

    #[test]
    fn test_is_project_valid() {
        // 测试存在的目录
        let home = dirs::home_dir().unwrap();
        assert!(ProjectService::is_project_valid(&home));

        // 测试不存在的目录
        let fake_path = PathBuf::from("/non/existent/path/12345");
        assert!(!ProjectService::is_project_valid(&fake_path));
    }
}
