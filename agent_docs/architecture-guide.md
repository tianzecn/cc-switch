# Architecture Guide

## Backend Layering

Commands (IPC) → Services (business logic) → DAO → SQLite

## Frontend Data Flow

Components ↔ Hooks ↔ TanStack Query ↔ API layer

## Key Design Patterns

- SSOT in `~/.cc-switch/cc-switch.db`
- Dual-layer storage: SQLite for syncable data, JSON for device settings
- Atomic writes using temp file + rename
- Mutex-protected DB access for concurrency safety

## Domain Modules (Backend)

| Module                | Purpose                                |
| --------------------- | -------------------------------------- |
| `provider.rs`         | Provider models and switching logic    |
| `app_config.rs`       | Config parsing for Claude/Codex/Gemini |
| `mcp/`                | MCP server management and sync         |
| `proxy/`              | Local proxy for API requests           |
| `services/skill.rs`   | Skills repository management           |
| `services/command.rs` | Slash command repository management    |
| `services/agent.rs`   | Agents configuration management        |
| `services/hook.rs`    | Hooks management                       |
| `services/prompt.rs`  | Prompt preset management               |
| `usage_script.rs`     | Usage statistics script injection      |

## Frontend Feature Areas

| Directory               | Purpose                           |
| ----------------------- | --------------------------------- |
| `components/providers/` | Provider management UI            |
| `components/mcp/`       | MCP server panel                  |
| `components/skills/`    | Skills discovery and installation |
| `components/commands/`  | Slash commands management         |
| `components/agents/`    | Agents configuration UI           |
| `components/hooks/`     | Hooks management UI               |
| `components/prompts/`   | Prompt preset editor              |
| `components/settings/`  | App settings dialogs              |
