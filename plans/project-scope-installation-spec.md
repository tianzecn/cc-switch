# 项目级安装功能规格说明书

> **版本**: v1.0
> **创建日期**: 2026-01-09
> **优先级**: 高（下一版本必须完成）
> **状态**: 待实现

---

## 1. 概述

### 1.1 背景

当前 CC Switch 的 Skills、Commands、Hooks、Agents 安装功能只支持**全局安装**（安装到 `~/.claude/`、`~/.codex/`、`~/.gemini/`）。

然而，Claude Code 原生支持**项目级配置**（安装到 `<project>/.claude/`），不同项目可以有不同的配置。本功能将为 CC Switch 增加项目级安装能力。

### 1.2 目标

- 支持资源安装到指定项目（项目级）
- 支持资源安装范围的切换（全局 ↔ 项目）
- 自动发现用户的 Claude Code 项目列表
- 提供清晰的 UI 展示安装范围信息

### 1.3 非目标（本期不实现）

- Codex/Gemini 的项目级安装（它们没有项目概念）
- 项目的手动添加/管理（完全依赖 Claude Code 的项目记录）

---

## 2. 核心设计

### 2.1 安装范围（Scope）定义

| 范围 | 安装位置 | 生效范围 | 同步到应用 |
|------|----------|----------|------------|
| **全局** | `~/.claude/skills/` 等 | 所有项目 | Claude + Codex + Gemini |
| **项目** | `<project>/.claude/skills/` 等 | 仅该项目 | 仅 Claude |

### 2.2 互斥原则

**同一资源不能同时存在于全局和项目中**

| 情况 | 处理方式 |
|------|----------|
| 已安装全局 → 安装到项目 | ❌ 禁止（全局已覆盖所有项目） |
| 已安装项目 → 安装到全局 | ✅ 允许（自动删除所有项目级安装） |
| 已安装项目A → 安装到项目B | ✅ 允许（多项目独立安装） |

### 2.3 范围变更策略

#### 2.3.1 升级（项目 → 全局）

```
场景：skill-A 已安装到 project-1, project-2
操作：用户选择「升级到全局」

执行：
1. 删除 project-1/.claude/skills/skill-A/
2. 删除 project-2/.claude/skills/skill-A/
3. 安装到 ~/.claude/skills/skill-A/
4. 更新数据库记录
```

#### 2.3.2 降级（全局 → 项目）

```
场景：skill-A 已安装到全局
操作：用户选择「移动到项目」

执行：
1. 弹出项目选择器（可多选）
2. 删除 ~/.claude/skills/skill-A/
3. 安装到选中的项目 <project>/.claude/skills/skill-A/
4. 更新数据库记录
```

---

## 3. 项目发现机制

### 3.1 数据源

完全依赖 Claude Code 的项目记录，位于 `~/.claude/projects/` 目录。

```
~/.claude/projects/
├── -Users-office-vscode-claude-cc-switch/
│   ├── xxx.jsonl  # 对话记录，包含 cwd 字段
│   └── ...
├── -Users-office-Documents-myproject/
└── ...
```

### 3.2 路径解码算法

目录名编码规则：路径中的 `/` 被替换为 `-`

**正确的解码方式**：从 `.jsonl` 文件中读取 `cwd` 字段

```rust
fn get_project_path(project_dir: &Path) -> Option<PathBuf> {
    for entry in fs::read_dir(project_dir).ok()? {
        let path = entry.ok()?.path();
        if path.extension() == Some(OsStr::new("jsonl")) {
            let content = fs::read_to_string(&path).ok()?;
            for line in content.lines() {
                if let Ok(json) = serde_json::from_str::<Value>(line) {
                    if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
                        return Some(PathBuf::from(cwd));
                    }
                }
            }
        }
    }
    None
}
```

### 3.3 项目列表过滤

| 条件 | 处理 |
|------|------|
| 路径不存在 | 标记为「已删除」，可显示但禁止安装 |
| 路径是 `~/.claude` | 过滤掉（这是配置目录，不是项目） |
| 无法解析 cwd | 跳过该记录 |

### 3.4 项目排序

按 Claude Code 最后使用时间降序排列（从 `.jsonl` 文件的修改时间获取）

---

## 4. UI 设计

### 4.1 发现模式 - 安装按钮

```
┌──────────────────────────────────────┐
│ skill-name                           │
│ Description...                       │
│                                      │
│              [安装 ▼] │
└──────────────────────────────────────┘

点击按钮：直接安装到全局（默认行为）
点击箭头：展开菜单
  ├── 安装到全局 (推荐)
  └── 安装到项目...  → 弹出项目选择器
```

### 4.2 已安装列表 - 范围标签

```
┌──────────────────────────────────────┐
│ skill-name                 [全局]    │  ← 可点击
│ Description...                       │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│ skill-name    [项目: cc-switch, ...]│  ← 可点击
│ Description...                       │
└──────────────────────────────────────┘
```

点击标签后弹出范围修改弹窗。

### 4.3 项目选择器弹窗

```
┌─────────────────────────────────────────────┐
│ 选择安装项目                           [×] │
├─────────────────────────────────────────────┤
│ 🔍 搜索项目...                              │
├─────────────────────────────────────────────┤
│ ☑ cc-switch                                 │
│   /Users/office/vscode/claude/cc-switch     │
│   最近使用: 2026-01-09 16:06                │
├─────────────────────────────────────────────┤
│ ☐ myclaudecode                              │
│   /Users/office/vscode/claude/myclaudecode  │
│   最近使用: 2026-01-09 11:38                │
├─────────────────────────────────────────────┤
│ ☐ learn-claude-code                         │
│   /Users/office/vscode/claude/learn-...     │
│   最近使用: 2026-01-07 16:59                │
├─────────────────────────────────────────────┤
│ ⚠️ test1 (项目已删除)                       │
│   /Users/office/Downloads/test1             │
├─────────────────────────────────────────────┤
│                    [取消]  [确认安装]       │
└─────────────────────────────────────────────┘
```

### 4.4 范围修改弹窗

```
┌─────────────────────────────────────────────┐
│ 修改安装范围                           [×] │
├─────────────────────────────────────────────┤
│ 当前范围: [全局]                            │
│                                             │
│ ○ 保持全局安装                              │
│ ● 移动到项目安装                            │
│                                             │
│ 选择项目:                                   │
│ ☑ cc-switch                                 │
│ ☐ myclaudecode                              │
│                                             │
│ ⚠️ 移动后将从全局删除，其他项目将无法使用   │
├─────────────────────────────────────────────┤
│                    [取消]  [确认修改]       │
└─────────────────────────────────────────────┘
```

### 4.5 多项目安装展示

当一个资源安装到多个项目时，合并显示：

```
[项目: cc-switch, myclaudecode]      ← 2个项目
[项目: cc-switch, +2]                ← 3个以上时折叠
```

点击标签展开完整列表。

---

## 5. 数据库设计

### 5.1 安装记录表修改

```sql
-- 现有表结构添加字段
ALTER TABLE installed_skills ADD COLUMN scope TEXT DEFAULT 'global';
ALTER TABLE installed_skills ADD COLUMN project_path TEXT;

-- scope 取值: 'global' | 'project'
-- project_path: 当 scope='project' 时存储项目路径
```

### 5.2 新增：项目缓存表（可选优化）

```sql
CREATE TABLE project_cache (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    last_used_at DATETIME,
    is_valid BOOLEAN DEFAULT TRUE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. 技术实现

### 6.1 后端服务层修改

```rust
// src-tauri/src/services/skill.rs

impl SkillService {
    /// 获取安装目录（支持项目级）
    pub fn get_install_dir(app: &AppType, scope: &InstallScope) -> Result<PathBuf> {
        match scope {
            InstallScope::Global => Self::get_app_skills_dir(app),
            InstallScope::Project(project_path) => {
                Ok(project_path.join(".claude").join("skills"))
            }
        }
    }

    /// 安装到指定范围
    pub async fn install_with_scope(
        &self,
        skill: &Skill,
        scope: InstallScope,
    ) -> Result<InstalledSkill> {
        // 1. 检查互斥
        self.check_scope_conflict(skill, &scope)?;

        // 2. 如果是升级到全局，先清理项目级安装
        if matches!(scope, InstallScope::Global) {
            self.cleanup_project_installations(skill).await?;
        }

        // 3. 执行安装
        let install_dir = Self::get_install_dir(&AppType::Claude, &scope)?;
        // ... 安装逻辑
    }
}

#[derive(Debug, Clone)]
pub enum InstallScope {
    Global,
    Project(PathBuf),
}
```

### 6.2 项目服务

```rust
// src-tauri/src/services/project.rs

pub struct ProjectService;

impl ProjectService {
    /// 获取所有 Claude Code 项目
    pub fn get_all_projects() -> Result<Vec<ProjectInfo>> {
        let projects_dir = dirs::home_dir()
            .context("无法获取用户主目录")?
            .join(".claude")
            .join("projects");

        let mut projects = Vec::new();

        for entry in fs::read_dir(&projects_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() && path.file_name()
                .map(|n| n.to_string_lossy().starts_with('-'))
                .unwrap_or(false)
            {
                if let Some(project) = Self::parse_project_dir(&path) {
                    projects.push(project);
                }
            }
        }

        // 按最近使用时间排序
        projects.sort_by(|a, b| b.last_used.cmp(&a.last_used));

        Ok(projects)
    }

    /// 从 jsonl 解析项目信息
    fn parse_project_dir(dir: &Path) -> Option<ProjectInfo> {
        let mut cwd = None;
        let mut last_used = None;

        for entry in fs::read_dir(dir).ok()? {
            let path = entry.ok()?.path();
            if path.extension() == Some(OsStr::new("jsonl")) {
                // 更新最后使用时间
                if let Ok(metadata) = path.metadata() {
                    let mtime = metadata.modified().ok()?;
                    if last_used.is_none() || Some(mtime) > last_used {
                        last_used = Some(mtime);
                    }
                }

                // 读取 cwd
                if cwd.is_none() {
                    cwd = Self::read_cwd_from_jsonl(&path);
                }
            }
        }

        let project_path = PathBuf::from(cwd?);
        let name = project_path.file_name()?.to_string_lossy().to_string();
        let is_valid = project_path.exists();

        Some(ProjectInfo {
            path: project_path,
            name,
            last_used: last_used.map(|t| DateTime::from(t)),
            is_valid,
        })
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProjectInfo {
    pub path: PathBuf,
    pub name: String,
    pub last_used: Option<DateTime<Utc>>,
    pub is_valid: bool,
}
```

### 6.3 前端 Hook

```typescript
// src/hooks/useProjects.ts

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => invoke<ProjectInfo[]>('get_all_projects'),
    staleTime: 30 * 1000, // 30秒缓存
  });
}

export function useInstallWithScope() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      resourceType,
      resourceId,
      scope
    }: InstallWithScopeParams) => {
      return invoke('install_with_scope', {
        resourceType,
        resourceId,
        scope
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['installed']);
    },
  });
}
```

---

## 7. 边界情况处理

### 7.1 新项目（无 .claude 目录）

当用户选择安装到一个没有 `.claude` 目录的项目时：

- **处理方式**：自动创建 `.claude` 目录及必要的子目录
- **无需确认**：这是标准行为，不需要弹窗确认

### 7.2 项目路径失效

当用户删除或移动了项目文件夹：

- **检测时机**：每次加载项目列表时
- **处理方式**：标记为「项目已删除」，禁止新安装，保留历史记录
- **用户操作**：可在设置中清理失效记录

### 7.3 Claude Code 版本兼容

- 检测 Claude Code 版本（通过 `claude --version` 或配置文件）
- 如果 projects 目录结构变化，使用对应版本的解析逻辑
- 解析失败时降级处理，显示空项目列表而非崩溃

---

## 8. 实现计划

### Phase 1: 基础架构（3-4天）

- [ ] 新增 `ProjectService` 服务
- [ ] 修改数据库 schema，添加 scope 相关字段
- [ ] 实现项目列表读取和缓存逻辑
- [ ] 添加 `install_with_scope` 命令

### Phase 2: 后端逻辑（3-4天）

- [ ] 修改 SkillService 支持项目级安装
- [ ] 修改 CommandService 支持项目级安装
- [ ] 修改 HookService 支持项目级安装
- [ ] 修改 AgentService 支持项目级安装
- [ ] 实现范围变更逻辑（升级/降级）

### Phase 3: 前端 UI（4-5天）

- [ ] 实现项目选择器弹窗组件
- [ ] 修改安装按钮为下拉菜单
- [ ] 实现范围标签展示
- [ ] 实现范围修改弹窗
- [ ] 多项目展示优化

### Phase 4: 测试与优化（2-3天）

- [ ] 单元测试
- [ ] 集成测试
- [ ] 边界情况测试
- [ ] 性能优化

**预计总工时**：12-16 天

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Claude Code 更新 projects 结构 | 项目列表解析失败 | 版本检测 + 容错设计 |
| 项目路径包含特殊字符 | 安装路径错误 | 路径转义 + 验证 |
| 大量项目导致列表过长 | UI 卡顿 | 虚拟滚动 + 搜索过滤 |
| 用户误操作删除全局安装 | 资源丢失 | 操作确认弹窗 |

---

## 10. 附录

### 10.1 相关文件

- `src-tauri/src/services/skill.rs` - Skills 服务
- `src-tauri/src/services/command.rs` - Commands 服务
- `src-tauri/src/services/hook.rs` - Hooks 服务
- `src-tauri/src/services/agent.rs` - Agents 服务
- `src/components/skills/` - Skills 前端组件

### 10.2 参考

- Claude Code 官方文档：项目级配置说明
- `~/.claude/projects/` 目录结构分析

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-09 | v1.0 | 初始版本 |
