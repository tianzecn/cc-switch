<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CC Switch is a cross-platform desktop application for managing Claude Code, Codex CLI, and Gemini CLI configurations. Built with Tauri 2 (Rust backend) + React (TypeScript frontend).

## Development Commands

```bash
# Install dependencies
pnpm install

# Development mode with hot reload
pnpm dev

# Build production application
pnpm build

# Build debug version
pnpm tauri build --debug

# Type checking
pnpm typecheck

# Format code
pnpm format

# Check format without modifying
pnpm format:check

# Run frontend tests
pnpm test:unit

# Run tests in watch mode
pnpm test:unit:watch
```

### Rust Backend Commands

```bash
cd src-tauri

# Format Rust code
cargo fmt

# Run clippy lints
cargo clippy

# Run backend tests
cargo test

# Run specific test
cargo test test_name

# Run tests with test-hooks feature
cargo test --features test-hooks
```

## Architecture

### Layered Architecture (Backend)

```
Commands (IPC Layer) → Services (Business Logic) → DAO → Database (SQLite)
```

- **Commands** (`src-tauri/src/commands/`): Tauri IPC handlers, thin wrappers
- **Services** (`src-tauri/src/services/`): Business logic, core functionality
- **DAO** (`src-tauri/src/database/dao/`): Data access objects for SQLite
- **Database** (`src-tauri/src/database/`): SQLite schema, migrations, backup

### Frontend Architecture

```
Components (UI) ←→ Hooks (Business Logic) ←→ TanStack Query (Cache) ←→ API Layer
```

- **Components** (`src/components/`): React UI organized by feature
- **Hooks** (`src/hooks/`): Custom hooks encapsulating business logic
- **API** (`src/lib/api/`): Type-safe Tauri IPC wrappers
- **Query** (`src/lib/query/`): TanStack Query configuration and keys

### Key Design Patterns

- **SSOT**: All data stored in `~/.cc-switch/cc-switch.db` (SQLite)
- **Dual-layer Storage**: SQLite for syncable data, JSON for device-level settings
- **Atomic Writes**: Temp file + rename pattern prevents corruption
- **Mutex-protected DB**: Concurrency-safe database access

### Domain Modules (Backend)

| Module | Purpose |
|--------|---------|
| `provider.rs` | Provider models and switching logic |
| `app_config.rs` | Claude/Codex/Gemini config file parsing |
| `mcp/` | MCP server management and sync |
| `proxy/` | Local proxy server for API requests |
| `services/skill.rs` | GitHub skills repository management |
| `services/command.rs` | Slash commands management (GitHub repos) |
| `services/agent.rs` | Agents configuration management |
| `services/hook.rs` | Hooks (event triggers) management |
| `services/prompt.rs` | System prompt preset management |
| `usage_script.rs` | Usage statistics script injection |

### Frontend Feature Areas

| Directory | Purpose |
|-----------|---------|
| `components/providers/` | Provider management UI |
| `components/mcp/` | MCP server panel |
| `components/skills/` | Skills discovery and installation |
| `components/commands/` | Slash commands management |
| `components/agents/` | Agents configuration UI |
| `components/hooks/` | Hooks (event triggers) management |
| `components/prompts/` | Prompt preset editor |
| `components/settings/` | App settings dialogs |

## Testing

- **Framework**: vitest + MSW (Mock Service Worker)
- **Component Testing**: @testing-library/react
- **Test Location**: `tests/hooks/` for hook tests, `tests/components/` for integration
- **Backend Tests**: `cargo test` in `src-tauri/`, some require `--features test-hooks`

## Config File Locations

| App | Live Config | MCP Config |
|-----|-------------|------------|
| Claude | `~/.claude/settings.json` | `~/.claude.json` |
| Codex | `~/.codex/auth.json` + `config.toml` | `~/.codex/config.toml` |
| Gemini | `~/.gemini/.env` + `settings.json` | `~/.gemini/settings.json` |
| CC Switch | `~/.cc-switch/cc-switch.db` | (stored in DB) |

## Important Conventions

- Frontend uses TanStack Query for all async state
- Backend commands should be thin; logic belongs in services
- All database mutations go through DAO layer
- Use `thiserror` for Rust error types
- i18n keys in `src/i18n/locales/` (zh/en/ja)

## 自动化文档维护规范

本项目采用自动化文档系统，确保项目知识持续更新。以下文档需要在特定时机更新：

### 文档职责

| 文档 | 用途 | 更新时机 |
|------|------|----------|
| `docs/architecture.md` | 系统架构设计 | 架构变更时 |
| `CHANGELOG.md` | 版本变更历史 | 功能完成/bug修复后 |
| `docs/project-status.md` | 当前进度和续点 | 每次会话结束时 |
| `CLAUDE.md` | 项目入口指南 | 重大架构变更时 |

### 更新触发条件

**自动更新场景**（AI 应主动执行）：

1. **完成重要开发任务后**
   - 更新 `CHANGELOG.md`（新功能/修复）
   - 更新 `docs/project-status.md`（进度变化）
   - 如涉及架构变更，更新 `docs/architecture.md`

2. **OpenSpec archive 后**
   - 自动更新 `CHANGELOG.md` 记录变更
   - 更新 `docs/project-status.md` 标记完成

3. **会话结束前**
   - 确保 `docs/project-status.md` 反映当前状态
   - 记录"下次继续"的建议

4. **用户明确要求时**
   - 按需更新指定文档

5. **Git commit 前检查**
   - 提交代码前，检查是否需要更新相关文档
   - 如有功能变更，确保 `CHANGELOG.md` 已更新
   - 如有重要进度，确保 `docs/project-status.md` 已更新

### 格式规范

**CHANGELOG.md** 遵循 [Keep a Changelog](https://keepachangelog.com/) 格式：
- Added: 新功能
- Changed: 功能变更
- Fixed: Bug 修复
- Removed: 移除的功能

**project-status.md** 包含：
- 近期完成的工作（带日期）
- 进行中的工作（带状态）
- 下次继续的建议
- 技术债务追踪

**architecture.md** 包含：
- 系统架构图
- 模块职责
- 设计决策记录 (ADR)
