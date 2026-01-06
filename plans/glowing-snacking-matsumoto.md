# Claude Code Hooks 统一管理功能实施计划

## 一、功能概述

为 Claude Code hooks 提供统一管理能力，参考现有 Agents 管理架构设计，实现：
- Hooks 的增删改查管理
- 多应用启用状态 (Claude/Codex/Gemini)
- 仓库管理共用（与 Commands/Agents 共用 `command_repos` 表）
- 命名空间组织（仓库 → 命名空间二级树）
- 发现与安装流程

## 二、架构设计

### 2.1 分层架构（沿用现有模式）

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend                                                    │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  HooksPage.tsx  │  │ HookNamespaceTree│  │ HooksList   │ │
│  └────────┬────────┘  └────────┬─────────┘  └──────┬──────┘ │
│           │                    │                    │        │
│           └────────────────────┼────────────────────┘        │
│                                ↓                             │
│                    ┌───────────────────────┐                │
│                    │   useHooks.ts (Hooks) │                │
│                    └───────────┬───────────┘                │
│                                ↓                             │
│                    ┌───────────────────────┐                │
│                    │   hooks.ts (API)      │                │
│                    └───────────┬───────────┘                │
└────────────────────────────────┼────────────────────────────┘
                                 │ Tauri IPC
┌────────────────────────────────┼────────────────────────────┐
│  Backend                       ↓                             │
│                    ┌───────────────────────┐                │
│                    │  hook.rs (Commands)   │                │
│                    └───────────┬───────────┘                │
│                                ↓                             │
│                    ┌───────────────────────┐                │
│                    │  HookService          │                │
│                    └───────────┬───────────┘                │
│                                ↓                             │
│                    ┌───────────────────────┐                │
│                    │  hooks.rs (DAO)       │                │
│                    └───────────┬───────────┘                │
│                                ↓                             │
│                    ┌───────────────────────┐                │
│                    │  SQLite Database      │                │
│                    │  - hooks              │                │
│                    │  - hook_discovery_cache│               │
│                    │  - command_repos (共用)│               │
│                    └───────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 三层存储设计

```
层级                    位置                                     用途
─────────────────────────────────────────────────────────────────────
SSOT                   ~/.cc-switch/hooks/                      真实数据源
                       ├── namespace1/
                       │   ├── hook1.json
                       │   └── hook2.json
                       └── hook3.json (根命名空间)

App 目录               ~/.claude/settings.json                  应用配置
                       ~/.codex/settings.json                   (hooks 字段)
                       ~/.gemini/settings.json

数据库                 cc-switch.db                             元数据+状态
                       - hooks 表
                       - hook_discovery_cache 表
```

### 2.3 与 Claude Code 配置的集成

Claude Code hooks 存储在 `settings.json` 的 `hooks` 字段中：

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{"type": "command", "command": "..."}] }
    ],
    "PostToolUse": [...],
    "PermissionRequest": [...],
    "SessionEnd": [...]
  }
}
```

**同步策略**：
- CC Switch 管理的 hooks 存储在 SSOT 目录
- 启用时合并写入 `settings.json` 的 `hooks` 字段
- 支持与现有手动配置的 hooks 共存

## 三、数据模型设计

### 3.1 核心数据结构

#### HookApps（三应用启用状态）
```rust
// src-tauri/src/app_config.rs
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct HookApps {
    pub claude: bool,
    pub codex: bool,
    pub gemini: bool,
}

impl HookApps {
    pub fn is_enabled_for(&self, app: &str) -> bool { ... }
    pub fn set_enabled_for(&mut self, app: &str, enabled: bool) { ... }
    pub fn only(app: &AppType) -> Self { ... }
}
```

#### HookEventType（事件类型）
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "PascalCase")]
pub enum HookEventType {
    PreToolUse,
    PostToolUse,
    PermissionRequest,
    SessionEnd,
}
```

#### HookType（Hook 执行类型）
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum HookType {
    Command { command: String },
    Prompt { prompt: String },
}
```

#### HookRule（Hook 规则）
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookRule {
    pub matcher: String,           // "Bash", "Edit|Write", "*", ""
    pub hooks: Vec<HookType>,
}
```

#### InstalledHook（已安装的 Hook）
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledHook {
    pub id: String,                 // "namespace/hookname" 或 "hookname"
    pub name: String,
    pub description: Option<String>,
    pub namespace: String,          // 空字符串表示根命名空间
    pub filename: String,           // 不含扩展名

    pub event_type: HookEventType,
    pub rules: Vec<HookRule>,

    // 状态
    pub enabled: bool,              // 全局启用状态
    pub priority: i32,              // 执行优先级（数字越小越先执行）

    // 仓库信息
    pub repo_owner: Option<String>,
    pub repo_name: Option<String>,
    pub repo_branch: Option<String>,
    pub readme_url: Option<String>,
    pub source_path: Option<String>,

    // 应用启用状态
    pub apps: HookApps,

    // 元数据
    pub file_hash: Option<String>,
    pub installed_at: i64,
}
```

#### DiscoverableHook（可发现的 Hook）
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoverableHook {
    pub key: String,                // 在仓库中的唯一标识
    pub name: String,
    pub description: Option<String>,
    pub namespace: String,
    pub filename: String,

    pub event_type: HookEventType,
    pub rules: Vec<HookRule>,
    pub priority: i32,

    pub repo_owner: String,
    pub repo_name: String,
    pub repo_branch: String,
    pub readme_url: Option<String>,
}
```

#### HookNamespace（命名空间）
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookNamespace {
    pub name: String,               // 空字符串表示根
    pub display_name: String,       // "Root" 或实际名称
    pub hook_count: usize,
}
```

### 3.2 SSOT 文件格式

每个 Hook 存储为独立的 JSON 文件：

```json
// ~/.cc-switch/hooks/security/pre-bash-check.json
{
  "name": "Pre-Bash Security Check",
  "description": "在执行 Bash 命令前进行安全检查",
  "event_type": "PreToolUse",
  "rules": [
    {
      "matcher": "Bash",
      "hooks": [
        {
          "type": "command",
          "command": "/path/to/security-check.sh"
        }
      ]
    }
  ],
  "priority": 10,
  "enabled": true
}
```

## 四、数据库设计

### 4.1 hooks 表

```sql
CREATE TABLE IF NOT EXISTS hooks (
    id TEXT PRIMARY KEY,                        -- "namespace/filename"
    name TEXT NOT NULL,
    description TEXT,
    namespace TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,

    event_type TEXT NOT NULL,                   -- "PreToolUse", "PostToolUse", etc.
    rules_json TEXT NOT NULL,                   -- JSON 序列化的 HookRule[]

    enabled INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 100,

    repo_owner TEXT,
    repo_name TEXT,
    repo_branch TEXT DEFAULT 'main',
    readme_url TEXT,
    source_path TEXT,

    enabled_claude INTEGER NOT NULL DEFAULT 0,
    enabled_codex INTEGER NOT NULL DEFAULT 0,
    enabled_gemini INTEGER NOT NULL DEFAULT 0,

    file_hash TEXT,
    installed_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_hooks_namespace ON hooks(namespace);
CREATE INDEX idx_hooks_event_type ON hooks(event_type);
CREATE INDEX idx_hooks_priority ON hooks(priority);
```

### 4.2 hook_discovery_cache 表

```sql
CREATE TABLE IF NOT EXISTS hook_discovery_cache (
    repo_owner TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    repo_branch TEXT NOT NULL,
    hooks_json TEXT NOT NULL,                   -- JSON 序列化的 DiscoverableHook[]
    scanned_at INTEGER NOT NULL,
    PRIMARY KEY (repo_owner, repo_name, repo_branch)
);
```

## 五、服务层设计

### 5.1 HookService 核心方法

```rust
// src-tauri/src/services/hook.rs
pub struct HookService;

impl HookService {
    // ========== 路径管理 ==========
    pub fn get_ssot_dir() -> PathBuf;
    pub fn id_to_relative_path(id: &str) -> PathBuf;
    pub fn relative_path_to_id(path: &Path) -> String;
    pub fn parse_id(id: &str) -> (String, String);  // (namespace, filename)

    // ========== CRUD 操作 ==========
    pub fn get_all_installed(db: &Database) -> Result<Vec<InstalledHook>>;
    pub fn get_hook(db: &Database, id: &str) -> Result<Option<InstalledHook>>;
    pub fn install(db: &Database, hook: &DiscoverableHook, current_app: &AppType) -> Result<InstalledHook>;
    pub fn uninstall(db: &Database, id: &str) -> Result<()>;
    pub fn toggle_enabled(db: &Database, id: &str, enabled: bool) -> Result<()>;
    pub fn toggle_app(db: &Database, id: &str, app: &str, enabled: bool) -> Result<()>;
    pub fn update_priority(db: &Database, id: &str, priority: i32) -> Result<()>;
    pub fn reorder_hooks(db: &Database, ids: Vec<String>) -> Result<()>;

    // ========== 命名空间管理 ==========
    pub fn create_namespace(namespace: &str) -> Result<()>;
    pub fn delete_namespace(db: &Database, namespace: &str) -> Result<()>;
    pub fn get_namespaces(db: &Database) -> Result<Vec<HookNamespace>>;

    // ========== 文件操作 ==========
    pub fn get_hook_content(id: &str) -> Result<String>;
    pub fn save_hook_content(id: &str, content: &str) -> Result<()>;
    pub fn open_in_editor(id: &str) -> Result<()>;

    // ========== 发现功能 ==========
    pub async fn discover_available(
        db: &Database,
        repos: Vec<CommandRepo>,
        force_refresh: bool
    ) -> Result<Vec<DiscoverableHook>>;

    // ========== 应用配置同步 ==========
    pub fn sync_to_app(db: &Database, app: &AppType) -> Result<usize>;
    pub fn sync_all_to_apps(db: &Database) -> Result<()>;
    pub fn generate_app_hooks_config(db: &Database, app: &AppType) -> Result<serde_json::Value>;

    // ========== 导入未管理 Hooks ==========
    pub fn scan_unmanaged(db: &Database) -> Result<Vec<UnmanagedHook>>;
    pub fn import_from_apps(db: &Database, hook_ids: Vec<String>) -> Result<usize>;

    // ========== 验证 ==========
    pub fn validate_hook(hook: &InstalledHook) -> Result<ValidationResult>;
    pub fn validate_matcher(matcher: &str) -> Result<bool>;

    // ========== SSOT 刷新 ==========
    pub fn refresh_from_ssot(db: &Database) -> Result<usize>;
}
```

### 5.2 应用配置同步流程

```
InstalledHook (数据库)
    ↓ 按 event_type 分组
    ↓ 按 priority 排序
    ↓ 过滤已启用的
    ↓
生成 hooks 配置
    ↓
合并到 settings.json
```

## 六、IPC 命令层设计

```rust
// src-tauri/src/commands/hook.rs

// ========== 读取操作 ==========
#[tauri::command]
pub fn get_installed_hooks(app_state: State<'_, AppState>) -> Result<Vec<InstalledHook>, String>;

#[tauri::command]
pub fn get_hook_namespaces(app_state: State<'_, AppState>) -> Result<Vec<HookNamespace>, String>;

#[tauri::command]
pub fn get_hook_content(id: String, app_state: State<'_, AppState>) -> Result<String, String>;

// ========== 写入操作 ==========
#[tauri::command]
pub async fn install_hook_unified(
    hook: DiscoverableHook,
    current_app: String,
    app_state: State<'_, AppState>
) -> Result<InstalledHook, String>;

#[tauri::command]
pub fn uninstall_hook_unified(id: String, app_state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub fn toggle_hook_enabled(id: String, enabled: bool, app_state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub fn toggle_hook_app(
    id: String,
    app: String,
    enabled: bool,
    app_state: State<'_, AppState>
) -> Result<bool, String>;

#[tauri::command]
pub fn update_hook_priority(id: String, priority: i32, app_state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub fn reorder_hooks(ids: Vec<String>, app_state: State<'_, AppState>) -> Result<bool, String>;

// ========== 命名空间操作 ==========
#[tauri::command]
pub fn create_hook_namespace(namespace: String, app_state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub fn delete_hook_namespace(namespace: String, app_state: State<'_, AppState>) -> Result<bool, String>;

// ========== 发现功能 ==========
#[tauri::command]
pub async fn discover_available_hooks(
    force_refresh: bool,
    app_state: State<'_, AppState>
) -> Result<Vec<DiscoverableHook>, String>;

// ========== 仓库管理（共用 command_repos）==========
#[tauri::command]
pub fn get_hook_repos(app_state: State<'_, AppState>) -> Result<Vec<CommandRepo>, String>;

#[tauri::command]
pub fn add_hook_repo(repo: CommandRepo, app_state: State<'_, AppState>) -> Result<bool, String>;

#[tauri::command]
pub fn remove_hook_repo(owner: String, name: String, app_state: State<'_, AppState>) -> Result<bool, String>;

// ========== 缓存管理 ==========
#[tauri::command]
pub fn clear_hook_cache(
    owner: Option<String>,
    name: Option<String>,
    app_state: State<'_, AppState>
) -> Result<usize, String>;

// ========== 同步操作 ==========
#[tauri::command]
pub fn sync_hooks_to_apps(app_state: State<'_, AppState>) -> Result<usize, String>;

#[tauri::command]
pub fn refresh_hooks_from_ssot(app_state: State<'_, AppState>) -> Result<usize, String>;

// ========== 导入操作 ==========
#[tauri::command]
pub fn scan_unmanaged_hooks(app_state: State<'_, AppState>) -> Result<Vec<UnmanagedHook>, String>;

#[tauri::command]
pub fn import_hooks_from_apps(
    hook_ids: Vec<String>,
    app_state: State<'_, AppState>
) -> Result<usize, String>;

// ========== 文件操作 ==========
#[tauri::command]
pub fn open_hook_in_editor(id: String, app_state: State<'_, AppState>) -> Result<bool, String>;
```

## 七、前端设计

### 7.1 API 层

```typescript
// src/lib/api/hooks.ts

export interface InstalledHook {
  id: string;
  name: string;
  description?: string;
  namespace: string;
  filename: string;
  eventType: HookEventType;
  rules: HookRule[];
  enabled: boolean;
  priority: number;
  repoOwner?: string;
  repoName?: string;
  repoBranch?: string;
  readmeUrl?: string;
  sourcePath?: string;
  apps: HookApps;
  fileHash?: string;
  installedAt: number;
}

export const hooksApi = {
  // 读取
  getInstalled: () => invoke<InstalledHook[]>("get_installed_hooks"),
  getNamespaces: () => invoke<HookNamespace[]>("get_hook_namespaces"),
  getContent: (id: string) => invoke<string>("get_hook_content", { id }),

  // 写入
  install: (hook: DiscoverableHook, currentApp: string) =>
    invoke<InstalledHook>("install_hook_unified", { hook, currentApp }),
  uninstall: (id: string) => invoke<boolean>("uninstall_hook_unified", { id }),
  toggleEnabled: (id: string, enabled: boolean) =>
    invoke<boolean>("toggle_hook_enabled", { id, enabled }),
  toggleApp: (id: string, app: string, enabled: boolean) =>
    invoke<boolean>("toggle_hook_app", { id, app, enabled }),
  updatePriority: (id: string, priority: number) =>
    invoke<boolean>("update_hook_priority", { id, priority }),
  reorder: (ids: string[]) => invoke<boolean>("reorder_hooks", { ids }),

  // 命名空间
  createNamespace: (namespace: string) =>
    invoke<boolean>("create_hook_namespace", { namespace }),
  deleteNamespace: (namespace: string) =>
    invoke<boolean>("delete_hook_namespace", { namespace }),

  // 发现
  discoverAvailable: (forceRefresh: boolean) =>
    invoke<DiscoverableHook[]>("discover_available_hooks", { forceRefresh }),

  // 仓库（共用）
  getRepos: () => invoke<CommandRepo[]>("get_hook_repos"),
  addRepo: (repo: CommandRepo) => invoke<boolean>("add_hook_repo", { repo }),
  removeRepo: (owner: string, name: string) =>
    invoke<boolean>("remove_hook_repo", { owner, name }),

  // 同步
  syncToApps: () => invoke<number>("sync_hooks_to_apps"),
  refreshFromSsot: () => invoke<number>("refresh_hooks_from_ssot"),

  // 导入
  scanUnmanaged: () => invoke<UnmanagedHook[]>("scan_unmanaged_hooks"),
  importFromApps: (hookIds: string[]) =>
    invoke<number>("import_hooks_from_apps", { hookIds }),

  // 文件
  openInEditor: (id: string) => invoke<boolean>("open_hook_in_editor", { id }),
};
```

### 7.2 React Hooks

```typescript
// src/hooks/useHooks.ts

export const hookKeys = {
  all: ["hooks"] as const,
  installed: () => [...hookKeys.all, "installed"] as const,
  namespaces: () => [...hookKeys.all, "namespaces"] as const,
  discoverable: () => [...hookKeys.all, "discoverable"] as const,
  unmanaged: () => [...hookKeys.all, "unmanaged"] as const,
  repos: () => [...hookKeys.all, "repos"] as const,
  content: (id: string) => [...hookKeys.all, "content", id] as const,
  byEvent: (event: string) => [...hookKeys.all, "byEvent", event] as const,
};

// Queries
export function useInstalledHooks();
export function useHookNamespaces();
export function useDiscoverableHooks(forceRefresh?: boolean);
export function useScanUnmanagedHooks();
export function useHookRepos();
export function useHookContent(id: string);

// Mutations
export function useInstallHook();
export function useUninstallHook();
export function useToggleHookEnabled();
export function useToggleHookApp();
export function useUpdateHookPriority();
export function useReorderHooks();
export function useCreateHookNamespace();
export function useDeleteHookNamespace();
export function useAddHookRepo();
export function useRemoveHookRepo();
export function useImportHooksFromApps();
export function useSyncHooksToApps();
export function useRefreshHooksFromSsot();
export function useOpenHookInEditor();
```

### 7.3 组件结构

```
src/components/hooks/
├── HooksPage.tsx                 # 主页面
├── HookNamespaceTree.tsx         # 左侧命名空间树
├── HooksList.tsx                 # 右侧 Hook 列表
├── HookCard.tsx                  # 单个 Hook 卡片
├── HookDiscovery.tsx             # 发现面板
├── HookImport.tsx                # 导入面板
├── HookEditor.tsx                # Hook 编辑器（JSON）
├── HookPriorityManager.tsx       # 优先级拖拽排序
├── HookEventFilter.tsx           # 事件类型筛选
└── HookRepoManager.tsx           # 仓库管理（复用）
```

## 八、实施步骤

### Phase 1: 后端基础设施（估计 2-3 天）

#### 1.1 数据模型
- [ ] 在 `app_config.rs` 添加 HookApps, HookEventType, HookType, HookRule 等结构
- [ ] 添加 InstalledHook, DiscoverableHook, HookNamespace 结构
- [ ] 实现序列化/反序列化

#### 1.2 数据库层
- [ ] 创建 `hooks.rs` DAO 文件
- [ ] 添加 hooks 表迁移
- [ ] 添加 hook_discovery_cache 表迁移
- [ ] 实现 CRUD 操作

#### 1.3 服务层
- [ ] 创建 `services/hook.rs`
- [ ] 实现路径管理方法
- [ ] 实现 CRUD 操作
- [ ] 实现命名空间管理
- [ ] 实现 SSOT 文件读写

### Phase 2: 发现与同步（估计 2 天）

#### 2.1 发现功能
- [ ] 实现仓库扫描逻辑
- [ ] 实现缓存机制
- [ ] 实现 JSON hook 文件解析

#### 2.2 应用配置同步
- [ ] 实现 settings.json hooks 字段读写
- [ ] 实现优先级排序合并
- [ ] 实现三应用同步

### Phase 3: IPC 命令层（估计 1 天）

- [ ] 创建 `commands/hook.rs`
- [ ] 注册所有 Tauri 命令
- [ ] 添加到 `main.rs` 命令注册

### Phase 4: 前端实现（估计 3-4 天）

#### 4.1 API 和 Hooks
- [ ] 创建 `lib/api/hooks.ts`
- [ ] 创建 `hooks/useHooks.ts`
- [ ] 添加 Query Keys

#### 4.2 组件开发
- [ ] HooksPage 主页面
- [ ] HookNamespaceTree 命名空间树
- [ ] HooksList 列表组件
- [ ] HookCard 卡片组件
- [ ] HookDiscovery 发现面板
- [ ] HookPriorityManager 优先级管理

#### 4.3 路由和导航
- [ ] 添加 Hooks 页面路由
- [ ] 添加侧边栏导航项
- [ ] 添加 i18n 翻译

### Phase 5: 测试和完善（估计 1-2 天）

- [ ] 后端单元测试
- [ ] 前端组件测试
- [ ] 集成测试
- [ ] 文档更新

## 九、关键文件清单

### 需要新建的文件

```
后端:
src-tauri/src/services/hook.rs           # Hook 服务层
src-tauri/src/commands/hook.rs           # IPC 命令层
src-tauri/src/database/dao/hooks.rs      # DAO 层

前端:
src/lib/api/hooks.ts                     # API 层
src/hooks/useHooks.ts                    # React Hooks
src/types/hooks.ts                       # 类型定义
src/components/hooks/HooksPage.tsx       # 主页面
src/components/hooks/HookNamespaceTree.tsx
src/components/hooks/HooksList.tsx
src/components/hooks/HookCard.tsx
src/components/hooks/HookDiscovery.tsx
src/components/hooks/HookPriorityManager.tsx
```

### 需要修改的文件

```
后端:
src-tauri/src/app_config.rs              # 添加数据模型
src-tauri/src/database/schema.rs         # 添加表结构
src-tauri/src/database/mod.rs            # 导出 DAO
src-tauri/src/services/mod.rs            # 导出服务
src-tauri/src/commands/mod.rs            # 导出命令
src-tauri/src/main.rs                    # 注册命令
src-tauri/Cargo.toml                     # 依赖（如需要）

前端:
src/App.tsx                              # 添加路由
src/components/layout/Sidebar.tsx        # 添加导航
src/i18n/locales/zh.json                 # 中文翻译
src/i18n/locales/en.json                 # 英文翻译
src/i18n/locales/ja.json                 # 日文翻译
```

## 十、设计决策（已确认）

| 决策项 | 选择 | 说明 |
|-------|------|------|
| Hook 文件格式 | **JSON** | 与 Claude Code 原生 hooks 配置格式一致 |
| 优先级管理 | **拖拽排序** | 提供直观的 UI 让用户调整同一事件类型下 hooks 的执行顺序 |
| 仓库目录 | **hooks/** | 专门的 hooks 目录，与 agents/, commands/ 并列 |
| 兼容模式 | **合并模式** | CC Switch 管理的 hooks 与用户手动配置的 hooks 共存，同步时合并 |

### 合并模式实现细节

1. **读取时**：解析 settings.json 中的 hooks 字段，识别哪些是 CC Switch 管理的（通过 SSOT 目录对比）
2. **写入时**：
   - 保留用户手动配置的 hooks（不在 SSOT 中的）
   - 合并 CC Switch 管理的已启用 hooks
   - 按 event_type 分组，按 priority 排序
3. **标记机制**：可选在 hook 中添加 `__cc_switch_managed: true` 标记便于区分
