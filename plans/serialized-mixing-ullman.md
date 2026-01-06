# Agents 管理功能实现计划

## 概述

参考 Commands 管理架构，为 Claude Code agents 提供统一管理能力。

### 用户需求确认
- **应用支持**：三应用都支持（Claude/Codex/Gemini）
- **SSOT 位置**：`~/.cc-switch/agents/`
- **仓库管理**：与 Commands 完全共用 `command_repos` 表

---

## 技术架构

```
Database Schema → DAO → Service → Tauri Commands → Frontend API → Hooks → Components
```

### 与 Commands 的差异

| 项目 | Commands | Agents |
|------|----------|--------|
| 文件格式 | `.md` YAML frontmatter | `.md` YAML frontmatter |
| SSOT 目录 | `~/.cc-switch/commands/` | `~/.cc-switch/agents/` |
| Claude 目录 | `~/.claude/commands/` | `~/.claude/agents/` |
| 仓库表 | `command_repos` | **共用** `command_repos` |
| 缓存表 | `command_discovery_cache` | `agent_discovery_cache` |

---

## 实现步骤

### Phase 1: 数据库层 (Day 1)

#### 1.1 添加 agents 表
```sql
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    namespace TEXT NOT NULL,
    source_path TEXT NOT NULL,
    description TEXT,
    model TEXT,
    tools TEXT,
    apps_claude INTEGER DEFAULT 0,
    apps_codex INTEGER DEFAULT 0,
    apps_gemini INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### 1.2 添加 agent_discovery_cache 表
```sql
CREATE TABLE agent_discovery_cache (
    id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    repo TEXT NOT NULL,
    branch TEXT NOT NULL,
    data TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    UNIQUE(owner, repo, branch)
);
```

#### 1.3 修改 command_repos 表
- 添加 `repo_type` 字段：`command` | `agent` | `both`
- 或保持原样，由 UI 层决定用途

**文件修改**：
- `src-tauri/src/database/schema.rs` - 添加表定义
- `src-tauri/src/database/dao/mod.rs` - 添加 agents DAO 模块

---

### Phase 2: DAO 层 (Day 1-2)

#### 2.1 创建 `src-tauri/src/database/dao/agents.rs`
参考 `commands.rs` 实现：
- `get_all_agents()` - 获取所有已安装 agents
- `get_agent_by_id()` - 按 ID 获取
- `insert_agent()` / `update_agent()` / `delete_agent()` - CRUD
- `get_agent_namespaces()` - 获取命名空间列表
- `update_agent_apps()` - 更新应用启用状态

#### 2.2 缓存管理方法
- `get_agent_discovery_cache()` - 获取缓存
- `set_agent_discovery_cache()` - 设置缓存
- `clear_agent_discovery_cache()` - 清理缓存

---

### Phase 3: Service 层 (Day 2-3)

#### 3.1 创建 `src-tauri/src/services/agent.rs`
核心功能：
- `get_ssot_dir()` → `~/.cc-switch/agents/`
- `get_app_agents_dir(app)` → 各应用的 agents 目录
- `scan_agents()` - 扫描 SSOT 目录
- `parse_agent_file()` - 解析 agent markdown 文件
- `install_agent()` - 从 GitHub 安装
- `uninstall_agent()` - 卸载
- `sync_to_app()` - 同步到目标应用
- `refresh_from_ssot()` - 从 SSOT 刷新数据库

#### 3.2 Agent 文件格式解析
```yaml
---
name: agent-name
description: Agent description
model: sonnet
tools:
  - Read
  - Write
  - Bash
---

Agent prompt content...
```

---

### Phase 4: Tauri Commands (Day 3)

#### 4.1 创建 `src-tauri/src/commands/agent.rs`
IPC 命令：
- `get_installed_agents` - 获取已安装列表
- `get_agent_namespaces` - 获取命名空间
- `install_agent` - 安装 agent
- `uninstall_agent` - 卸载 agent
- `update_agent_apps` - 更新应用状态
- `discover_agents` - 发现可用 agents
- `refresh_agents_from_ssot` - 刷新

#### 4.2 注册命令
修改 `src-tauri/src/lib.rs` 添加 agent 命令注册

---

### Phase 5: Frontend API (Day 3-4)

#### 5.1 创建 `src/lib/api/agents.ts`
TypeScript 类型定义：
```typescript
interface InstalledAgent {
  id: string;
  name: string;
  namespace: string;
  source_path: string;
  description?: string;
  model?: string;
  tools?: string[];
  apps: { claude: boolean; codex: boolean; gemini: boolean };
  created_at: string;
  updated_at: string;
}

interface DiscoverableAgent {
  name: string;
  path: string;
  description?: string;
  model?: string;
  tools?: string[];
  installed: boolean;
}
```

API 方法封装（与 commands.ts 对应）

---

### Phase 6: React Hooks (Day 4)

#### 6.1 创建 `src/hooks/useAgents.ts`
Query Keys：
```typescript
export const agentKeys = {
  all: ['agents'] as const,
  installed: () => [...agentKeys.all, 'installed'] as const,
  namespaces: () => [...agentKeys.all, 'namespaces'] as const,
  discovery: (owner: string, repo: string, branch: string) =>
    [...agentKeys.all, 'discovery', owner, repo, branch] as const,
};
```

Hooks：
- `useInstalledAgents()` - 获取已安装列表
- `useAgentNamespaces()` - 获取命名空间
- `useDiscoverAgents()` - 发现 agents
- `useInstallAgent()` - 安装 mutation
- `useUninstallAgent()` - 卸载 mutation
- `useUpdateAgentApps()` - 更新应用状态 mutation

---

### Phase 7: UI 组件 (Day 4-5)

#### 7.1 重构 `src/components/agents/AgentsPanel.tsx`
参考 `CommandsPage.tsx` 实现双栏布局：
- 左侧：命名空间树
- 右侧：Agents 列表

#### 7.2 创建组件
| 组件 | 功能 |
|------|------|
| `AgentsList.tsx` | 已安装 agents 列表 |
| `AgentCard.tsx` | 单个 agent 卡片 |
| `AgentDiscovery.tsx` | 发现页面 |
| `AgentDiscoveryTree.tsx` | 发现页命名空间树 |
| `AgentNamespaceTree.tsx` | 管理页命名空间树 |

#### 7.3 共用组件
- `CommandRepoManager.tsx` → 重命名为 `RepoManager.tsx`（共用）
- 或保持原名但支持 `type: 'command' | 'agent'` 参数

---

### Phase 8: i18n (Day 5)

添加翻译 key：
```json
{
  "agents": {
    "title": "Agents 管理",
    "subtitle": "管理 Claude Code agents",
    "installed": "已安装 {count} 个",
    "discover": "发现",
    "import": "导入",
    "refresh": "刷新",
    "apps": {
      "claude": "Claude",
      "codex": "Codex",
      "gemini": "Gemini"
    }
  }
}
```

---

## 文件清单

### 新增文件
- `src-tauri/src/database/dao/agents.rs`
- `src-tauri/src/services/agent.rs`
- `src-tauri/src/commands/agent.rs`
- `src/lib/api/agents.ts`
- `src/hooks/useAgents.ts`
- `src/components/agents/AgentsList.tsx`
- `src/components/agents/AgentCard.tsx`
- `src/components/agents/AgentDiscovery.tsx`
- `src/components/agents/AgentDiscoveryTree.tsx`
- `src/components/agents/AgentNamespaceTree.tsx`

### 修改文件
- `src-tauri/src/database/schema.rs` - 添加 agents 表
- `src-tauri/src/database/dao/mod.rs` - 导出 agents 模块
- `src-tauri/src/database/mod.rs` - 导出类型
- `src-tauri/src/services/mod.rs` - 导出 agent service
- `src-tauri/src/commands/mod.rs` - 导出 agent commands
- `src-tauri/src/lib.rs` - 注册命令
- `src/components/agents/AgentsPanel.tsx` - 重构为完整功能
- `src/components/commands/CommandRepoManager.tsx` - 可能需要泛化
- `src/i18n/locales/*.json` - 添加翻译

---

## 风险评估

1. **仓库共用复杂度**：共用 `command_repos` 需要在 UI 层区分用途
2. **Agent 文件格式兼容**：需要处理多种 frontmatter 格式
3. **三应用目录差异**：Codex/Gemini 的 agents 目录需要确认

---

## 预计工期

5 个工作日

| 阶段 | 天数 |
|------|------|
| Phase 1-2: 数据库 + DAO | 1.5 |
| Phase 3-4: Service + Commands | 1.5 |
| Phase 5-6: API + Hooks | 1 |
| Phase 7-8: UI + i18n | 1 |

---

## 验收标准

- [ ] 可以从 GitHub 仓库发现 agents
- [ ] 可以安装/卸载 agents 到 SSOT
- [ ] 可以为每个应用独立启用/禁用
- [ ] 仓库管理与 Commands 共用
- [ ] 缓存机制正常工作
- [ ] 三语言翻译完整
