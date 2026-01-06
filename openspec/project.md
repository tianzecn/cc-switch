# Project Context

## Purpose

CC Switch 是一个跨平台桌面应用程序，作为 Claude Code、Codex CLI 和 Gemini CLI 的一站式配置管理助手。

**核心功能：**
- **Provider 管理**：快速切换 AI 服务商配置（API Key、Base URL 等）
- **MCP 服务器管理**：统一管理三个 CLI 工具的 MCP（Model Context Protocol）服务器配置
- **Skills 管理**：发现、安装和管理 GitHub 上的 Claude Code Skills
- **Prompt 预设**：创建和管理系统提示词模板
- **本地代理**：提供 API 请求代理服务，支持用量统计
- **配置同步**：单一数据源（SSOT）确保配置一致性

## Tech Stack

### 前端
- **框架**: React 18 + TypeScript 5.3
- **构建工具**: Vite 7.3
- **状态管理**: TanStack Query 5（异步状态）
- **样式**: Tailwind CSS 3.4
- **UI 组件**: Radix UI + shadcn/ui 模式
- **代码编辑器**: CodeMirror 6
- **动画**: Framer Motion
- **国际化**: i18next（中/英/日）
- **表单**: React Hook Form + Zod 验证
- **拖拽**: dnd-kit

### 后端 (Rust)
- **框架**: Tauri 2.8
- **Rust 版本**: 1.85+
- **数据库**: SQLite (rusqlite 0.31)
- **异步运行时**: Tokio
- **HTTP 服务器**: Axum 0.7（本地代理）
- **HTTP 客户端**: reqwest 0.12
- **错误处理**: thiserror + anyhow
- **序列化**: serde + serde_json

### 测试
- **前端**: Vitest + @testing-library/react + MSW
- **后端**: cargo test + serial_test

### 包管理
- **前端**: pnpm 10
- **后端**: Cargo

## Project Conventions

### Code Style

#### TypeScript/React
- 使用 Prettier 格式化（配置于项目根目录）
- 组件使用函数式组件 + Hooks
- 使用 `const` 声明组件，避免 `function`
- 文件命名：组件用 PascalCase，工具函数用 camelCase
- 类型优先：使用 `interface` 定义对象类型，`type` 定义联合类型
- 避免 `any`，必要时使用 `unknown`

#### Rust
- 使用 `cargo fmt` 格式化
- 使用 `cargo clippy` 检查代码质量
- 错误类型使用 `thiserror` 派生
- 模块组织遵循 `mod.rs` 模式
- 命名：snake_case 变量/函数，PascalCase 类型

### Architecture Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  Components ←→ Hooks ←→ TanStack Query ←→ API Layer         │
└─────────────────────────────────────────────────────────────┘
                              ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  Commands (IPC) → Services (业务逻辑) → DAO → SQLite        │
└─────────────────────────────────────────────────────────────┘
```

**关键原则：**
- **SSOT（单一数据源）**：所有配置存储于 `~/.cc-switch/cc-switch.db`
- **分层架构**：Commands 薄包装，业务逻辑在 Services
- **DAO 模式**：所有数据库操作通过 DAO 层
- **Mutex 保护**：数据库访问并发安全
- **原子写入**：临时文件 + 重命名防止损坏

### Testing Strategy

#### 前端测试
- **单元测试**: `pnpm test:unit`
- **测试目录**: `tests/hooks/`, `tests/components/`
- **Mock**: 使用 MSW 模拟 Tauri IPC 调用
- **覆盖范围**: 重点测试自定义 Hooks 和关键组件

#### 后端测试
- **单元测试**: `cargo test`
- **特性测试**: `cargo test --features test-hooks`
- **测试隔离**: 使用 `serial_test` 确保测试顺序执行
- **临时文件**: 使用 `tempfile` 创建测试环境

### Git Workflow

- **主分支**: `main`
- **提交规范**: Conventional Commits
  - `feat:` 新功能
  - `fix:` Bug 修复
  - `refactor:` 重构
  - `docs:` 文档
  - `test:` 测试
  - `chore:` 杂项
- **提交消息**: 中文或英文均可，保持一致性
- **PR 合并**: Squash merge 到 main

## Domain Context

### 配置文件位置

| 应用 | 实时配置 | MCP 配置 |
|------|----------|----------|
| Claude | `~/.claude/settings.json` | `~/.claude.json` |
| Codex | `~/.codex/auth.json` + `config.toml` | `~/.codex/config.toml` |
| Gemini | `~/.gemini/.env` + `settings.json` | `~/.gemini/settings.json` |
| CC Switch | `~/.cc-switch/cc-switch.db` | (存储于 DB) |

### 核心领域模块

| 模块 | 职责 |
|------|------|
| `provider` | Provider 模型和切换逻辑 |
| `app_config` | CLI 配置文件解析和写入 |
| `mcp/` | MCP 服务器管理和同步 |
| `proxy/` | 本地 API 代理服务器 |
| `skill` | GitHub Skills 仓库管理 |
| `prompt` | 系统提示词预设管理 |

## Important Constraints

### 技术约束
- **跨平台支持**: macOS、Windows、Linux
- **Rust 版本**: 最低 1.85.0
- **Node 版本**: 建议 20+
- **数据库**: 仅支持 SQLite，不依赖外部数据库

### 安全约束
- API Key 等敏感信息加密存储于 SQLite
- 本地代理仅监听 localhost
- 不向外部服务发送用户配置数据

### 性能约束
- 启动时间 < 3 秒
- 配置切换即时生效
- 数据库操作使用 Mutex 避免竞争

## External Dependencies

### 外部服务
- **GitHub API**: Skills 仓库发现和下载
- **AI Provider API**: 代理转发（Anthropic、OpenAI 等）

### 文件系统依赖
- Claude Code: `~/.claude/`
- Codex CLI: `~/.codex/`
- Gemini CLI: `~/.gemini/`
- CC Switch: `~/.cc-switch/`

### Tauri 插件
- `tauri-plugin-dialog`: 原生对话框
- `tauri-plugin-process`: 进程管理
- `tauri-plugin-store`: 本地存储
- `tauri-plugin-updater`: 应用更新
- `tauri-plugin-single-instance`: 单实例运行
- `tauri-plugin-deep-link`: 深度链接处理
