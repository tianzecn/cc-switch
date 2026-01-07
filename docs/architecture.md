# CC Switch 系统架构文档

> 本文档记录 CC Switch 的系统设计和架构决策。当架构发生重大变更时应同步更新。
>
> **最后更新**: 2026-01-07

## 概述

CC Switch 是一个跨平台桌面应用，用于管理 Claude Code、Codex CLI 和 Gemini CLI 的配置。

**技术栈**:
- **后端**: Tauri 2 (Rust)
- **前端**: React + TypeScript
- **数据库**: SQLite (rusqlite)
- **UI 框架**: shadcn/ui + Tailwind CSS
- **状态管理**: TanStack Query

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Components│←→│  Hooks   │←→│TanStack  │←→│ API Layer│    │
│  │   (UI)   │  │(Business)│  │  Query   │  │(IPC Wrap)│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              ↑ Tauri IPC
┌─────────────────────────────────────────────────────────────┐
│                       Backend (Rust)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Commands │→ │ Services │→ │   DAO    │→ │  SQLite  │    │
│  │(IPC Layer)│  │(Business)│  │(Data Acc)│  │ Database │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## 后端架构 (Rust)

### 分层职责

| 层级 | 目录 | 职责 |
|------|------|------|
| **Commands** | `src-tauri/src/commands/` | Tauri IPC 处理器，薄封装层 |
| **Services** | `src-tauri/src/services/` | 核心业务逻辑 |
| **DAO** | `src-tauri/src/database/dao/` | 数据访问对象 |
| **Database** | `src-tauri/src/database/` | SQLite schema、迁移、备份 |

### 核心模块

| 模块 | 路径 | 用途 |
|------|------|------|
| Provider | `services/provider.rs` | Provider 模型和切换逻辑 |
| App Config | `services/app_config.rs` | Claude/Codex/Gemini 配置解析 |
| MCP | `services/mcp/` | MCP 服务器管理和同步 |
| Proxy | `services/proxy/` | 本地代理服务器 |
| Skill | `services/skill.rs` | GitHub Skills 仓库管理 |
| Command | `services/command.rs` | Slash 命令管理 |
| Agent | `services/agent.rs` | Agents 配置管理 |
| Hook | `services/hook.rs` | Hooks 事件触发管理 |
| Prompt | `services/prompt.rs` | 系统提示词预设管理 |

### 关键设计模式

- **SSOT (单一数据源)**: 所有数据存储在 `~/.cc-switch/cc-switch.db`
- **双层存储**: SQLite 存可同步数据，JSON 存设备级设置
- **原子写入**: Temp file + rename 模式防止数据损坏
- **Mutex 保护**: 数据库并发安全访问

## 前端架构 (React)

### 分层职责

| 层级 | 目录 | 职责 |
|------|------|------|
| **Components** | `src/components/` | React UI 按功能组织 |
| **Hooks** | `src/hooks/` | 封装业务逻辑的自定义 hooks |
| **API** | `src/lib/api/` | 类型安全的 Tauri IPC 封装 |
| **Query** | `src/lib/query/` | TanStack Query 配置和 keys |

### 功能模块

| 目录 | 用途 |
|------|------|
| `components/providers/` | Provider 管理 UI |
| `components/mcp/` | MCP 服务器面板 |
| `components/skills/` | Skills 发现和安装 |
| `components/commands/` | Slash 命令管理 |
| `components/agents/` | Agents 配置 UI |
| `components/hooks/` | Hooks 事件管理 |
| `components/prompts/` | 提示词预设编辑器 |
| `components/settings/` | 应用设置对话框 |

## 数据流

### 配置同步流程

```
User Action → React Component → Custom Hook → TanStack Query
     ↓
API Layer (invoke) → Tauri IPC → Rust Command
     ↓
Service Layer → DAO → SQLite
     ↓
File System Sync (claude.json / codex.toml / gemini settings)
```

### 配置文件位置

| 应用 | Live Config | MCP Config |
|------|-------------|------------|
| Claude | `~/.claude/settings.json` | `~/.claude.json` |
| Codex | `~/.codex/auth.json` + `config.toml` | `~/.codex/config.toml` |
| Gemini | `~/.gemini/.env` + `settings.json` | `~/.gemini/settings.json` |
| CC Switch | `~/.cc-switch/cc-switch.db` | (stored in DB) |

## 架构决策记录 (ADR)

### ADR-001: 选择 SQLite 作为主数据存储

**背景**: 需要持久化存储用户配置和 Provider 数据。

**决策**: 使用 SQLite 而非 JSON 文件。

**原因**:
- 支持复杂查询
- 事务保证数据一致性
- 便于未来扩展（如云同步）
- rusqlite 提供良好的 Rust 集成

### ADR-002: 使用 TanStack Query 管理前端状态

**背景**: 需要处理异步数据获取、缓存和同步。

**决策**: 采用 TanStack Query 而非 Redux/Zustand。

**原因**:
- 内置缓存和去重
- 自动重新获取
- 乐观更新支持
- 减少样板代码

---

## 更新日志

| 日期 | 变更内容 | 作者 |
|------|----------|------|
| 2026-01-07 | 初始化架构文档 | Claude |
