# Design: Project Scope Installation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
│  ProjectSelector ──► useProjects ──► TanStack Query             │
│  ScopeBadge      ──► useInstallWithScope                        │
│  ScopeModifyDialog                                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓ IPC
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                  │
│  Commands: get_all_projects, install_with_scope,                │
│            change_install_scope                                  │
│                              ↓                                   │
│  Services: ProjectService, SkillService (修改),                 │
│            CommandService, HookService, AgentService            │
│                              ↓                                   │
│  DAO: skills (添加 scope, project_path 字段)                    │
│       commands, hooks, agents (同上)                            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. 项目发现流程

```
~/.claude/projects/
    │
    ├── -Users-xxx-project-a/
    │       └── xxx.jsonl  ──► 解析 cwd 字段 ──► "/Users/xxx/project-a"
    │
    └── -Users-xxx-project-b/
            └── xxx.jsonl  ──► 解析 cwd 字段 ──► "/Users/xxx/project-b"
```

**流程：**
1. 扫描 `~/.claude/projects/` 目录
2. 遍历每个子目录的 `.jsonl` 文件
3. 解析 JSON 获取 `cwd` 字段作为真实路径
4. 验证路径是否存在，标记失效项目
5. 按最后使用时间排序返回

### 2. 安装范围切换流程

#### 升级（项目 → 全局）

```
用户点击 [项目: A, B] 标签
    ↓
弹出 ScopeModifyDialog
    ↓
用户选择 "升级到全局"
    ↓
调用 change_install_scope(id, Global)
    ↓
后端执行：
  1. 删除 project-A/.claude/skills/xxx/
  2. 删除 project-B/.claude/skills/xxx/
  3. 安装到 ~/.claude/skills/xxx/
  4. 更新数据库：scope='global', project_path=NULL
    ↓
前端刷新列表
```

#### 降级（全局 → 项目）

```
用户点击 [全局] 标签
    ↓
弹出 ScopeModifyDialog
    ↓
用户选择 "移动到项目" + 选择项目 A
    ↓
调用 change_install_scope(id, Project(path_a))
    ↓
后端执行：
  1. 删除 ~/.claude/skills/xxx/
  2. 创建 project-A/.claude/skills/ 目录（如不存在）
  3. 安装到 project-A/.claude/skills/xxx/
  4. 更新数据库：scope='project', project_path=path_a
    ↓
前端刷新列表
```

## Database Schema Changes

### 现有表修改

```sql
-- skills 表
ALTER TABLE skills ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
ALTER TABLE skills ADD COLUMN project_path TEXT;

-- commands 表
ALTER TABLE commands ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
ALTER TABLE commands ADD COLUMN project_path TEXT;

-- hooks 表
ALTER TABLE hooks ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
ALTER TABLE hooks ADD COLUMN project_path TEXT;

-- agents 表
ALTER TABLE agents ADD COLUMN scope TEXT NOT NULL DEFAULT 'global';
ALTER TABLE agents ADD COLUMN project_path TEXT;
```

### 索引

```sql
CREATE INDEX idx_skills_scope ON skills(scope);
CREATE INDEX idx_skills_project_path ON skills(project_path);
-- 其他表类似
```

## Key Types

### Rust

```rust
/// 安装范围
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "path")]
pub enum InstallScope {
    /// 全局安装
    Global,
    /// 项目安装
    Project(PathBuf),
}

/// 项目信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    /// 项目路径
    pub path: PathBuf,
    /// 项目名称（目录名）
    pub name: String,
    /// 最后使用时间
    pub last_used: Option<DateTime<Utc>>,
    /// 路径是否有效
    pub is_valid: bool,
}
```

### TypeScript

```typescript
interface InstallScope {
  type: 'global' | 'project';
  path?: string;
}

interface ProjectInfo {
  path: string;
  name: string;
  lastUsed: string | null;
  isValid: boolean;
}
```

## Component Design

### ProjectSelector

多选弹窗组件，用于选择安装目标项目。

**Props:**
- `open: boolean` - 控制显示/隐藏
- `onOpenChange: (open: boolean) => void`
- `selectedProjects: string[]` - 已选择的项目路径
- `onConfirm: (projects: string[]) => void`

**功能：**
- 搜索过滤
- 按最近使用时间排序
- 显示项目名称 + 路径
- 标记失效项目（禁用选择）

### ScopeBadge

范围标签组件，显示当前安装范围。

**Props:**
- `scope: InstallScope`
- `projectPaths?: string[]` - 项目路径列表（用于多项目展示）
- `onClick?: () => void`

**展示：**
- 全局：`[全局]`
- 单项目：`[项目: cc-switch]`
- 多项目：`[项目: cc-switch, +2]`

### ScopeModifyDialog

范围修改弹窗组件。

**Props:**
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `resourceType: 'skill' | 'command' | 'hook' | 'agent'`
- `resourceId: string`
- `currentScope: InstallScope`
- `currentProjects?: string[]`

## Error Handling

### 项目路径失效

当安装目标项目已被删除：

```
尝试安装到 /Users/xxx/deleted-project
    ↓
检测到路径不存在
    ↓
返回错误：PROJECT_PATH_NOT_FOUND
    ↓
前端显示 Toast：「项目路径不存在，可能已被删除」
```

### 互斥冲突

当尝试违反互斥原则：

```
资源已安装到全局，尝试安装到项目
    ↓
检测到冲突
    ↓
返回错误：SCOPE_CONFLICT_GLOBAL_EXISTS
    ↓
前端显示 Toast：「该资源已安装到全局，请先移除全局安装」
```

## Performance Considerations

### 项目列表缓存

- 前端使用 TanStack Query 缓存，staleTime: 30 秒
- 后端可选实现内存缓存，TTL: 60 秒

### 大量项目优化

- 项目选择器使用虚拟滚动（当项目 > 50 个时）
- 支持搜索过滤减少渲染量

## Migration Strategy

### 数据库迁移

1. 添加新字段（scope, project_path）
2. 设置默认值：scope='global', project_path=NULL
3. 现有数据无需迁移，自动视为全局安装

### 渐进式发布

1. Phase 1: 仅 Skills 支持项目级安装
2. Phase 2: Commands、Hooks、Agents 支持
3. Phase 3: UI 优化、性能优化
