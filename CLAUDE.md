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

# Project Context for Claude Code

## Project Overview (WHAT)

CC Switch is a cross-platform desktop app for managing Claude Code, Codex CLI, and Gemini CLI configurations.
Built with Tauri 2 (Rust backend) and React + TypeScript (frontend).

## Why This Repository Exists (WHY)

- unify provider, MCP, prompt, and hook configuration across multiple AI CLIs
- provide a single UI to switch and sync configs safely
- persist syncable data in SQLite with JSON device settings

## Directory Structure

- `src/` React frontend UI
- `src-tauri/` Rust backend and Tauri commands
- `tests/` frontend tests
- `docs/` long-form project docs
- `openspec/` spec-driven change management

## How to Work with This Project (HOW)

- Requirements: Node.js 18+, pnpm 8+, Rust 1.85+, Tauri CLI 2.8+
- Quick start: `pnpm install` then `pnpm dev`
- Build: `pnpm build`
- Type check: `pnpm typecheck`
- Full command list: `agent_docs/dev-commands.md`
- Testing details: `agent_docs/testing.md`
- Formatting/linting is handled via Biome/ESLint; prefer a Stop Hook: https://code.claude.com/docs/en/hooks#stop

## Key Architecture Decisions

- Backend is layered: Commands → Services → DAO → SQLite
- Frontend uses hooks + TanStack Query for async state
- SSOT lives in `~/.cc-switch/cc-switch.db`; device settings are JSON
- File writes are atomic (temp + rename); DB access is mutex-protected

## Important Files

| Area                    | Files                     |
| ----------------------- | ------------------------- |
| Backend commands        | `src-tauri/src/commands/` |
| Backend services        | `src-tauri/src/services/` |
| Database schema and DAO | `src-tauri/src/database/` |
| Frontend API wrappers   | `src/lib/api/`            |
| Frontend components     | `src/components/`         |
| i18n locales            | `src/i18n/locales/`       |

## Detailed Documentation (Progressive Disclosure)

| Topic                    | Document                                 |
| ------------------------ | ---------------------------------------- |
| Architecture deep dive   | `agent_docs/architecture-guide.md`       |
| Config locations         | `agent_docs/config-locations.md`         |
| Documentation automation | `agent_docs/documentation-automation.md` |
| Development commands     | `agent_docs/dev-commands.md`             |
| Testing guide            | `agent_docs/testing.md`                  |
| OpenSpec workflow        | `openspec/AGENTS.md`                     |
| Project status           | `docs/project-status.md`                 |
| Release history          | `CHANGELOG.md`                           |

## Project Rules

- Keep IPC commands thin; business logic lives in services
- All database writes go through the DAO layer
- Maintain i18n keys in `src/i18n/locales/`
- Follow OpenSpec workflow for proposals and architecture changes
- Update docs listed in `agent_docs/documentation-automation.md` when changes warrant it
