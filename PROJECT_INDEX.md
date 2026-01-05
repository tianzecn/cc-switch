# Project Index: CC Switch

**Generated**: 2026-01-05
**Version**: 3.9.0-3
**Tech Stack**: Tauri 2 + React 18 + TypeScript + Rust + SQLite

---

## Project Structure

```
cc-switch/
├── src/                      # Frontend (React + TypeScript)
│   ├── components/           # UI components by feature
│   │   ├── providers/        # Provider management (cards, forms, dialogs)
│   │   ├── mcp/              # MCP server panel
│   │   ├── skills/           # Skills discovery & installation
│   │   ├── prompts/          # System prompt presets
│   │   ├── proxy/            # Local proxy configuration
│   │   ├── settings/         # App settings
│   │   └── ui/               # Shadcn/ui base components
│   ├── hooks/                # Custom React hooks (business logic)
│   ├── lib/
│   │   ├── api/              # Tauri IPC wrappers (type-safe)
│   │   └── query/            # TanStack Query configuration
│   ├── config/               # Provider & MCP presets
│   └── i18n/locales/         # Translations (zh/en/ja)
├── src-tauri/                # Backend (Rust)
│   └── src/
│       ├── commands/         # Tauri IPC command handlers
│       ├── services/         # Business logic layer
│       ├── database/         # SQLite schema, DAO, migrations
│       ├── proxy/            # Local API proxy server
│       ├── mcp/              # MCP sync per app
│       └── deeplink/         # Deep link protocol handlers
└── tests/                    # Frontend tests (vitest + MSW)
```

---

## Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| **Frontend** | `src/main.tsx` | React app bootstrap, i18n, QueryClient |
| **App Root** | `src/App.tsx` | Main app component (28K LOC) |
| **Backend** | `src-tauri/src/main.rs` | Tauri app entry |
| **Lib** | `src-tauri/src/lib.rs` | Core logic, tray menu, command registration |

---

## Backend Architecture (Layered)

```
Commands (IPC) → Services (Business Logic) → DAO → SQLite
```

### Commands (`src-tauri/src/commands/`)
| Module | Handlers |
|--------|----------|
| `provider.rs` | CRUD, switch, duplicate, sort |
| `mcp.rs` | MCP server management |
| `skill.rs` | Skills discovery & install |
| `prompt.rs` | Prompt preset operations |
| `proxy.rs` | Local proxy control |
| `config.rs` | Import/export |
| `settings.rs` | App settings |
| `usage.rs` | Usage statistics |
| `failover.rs` | Failover queue |
| `deeplink.rs` | `ccswitch://` protocol |

### Services (`src-tauri/src/services/`)
| Service | Purpose |
|---------|---------|
| `ProviderService` | Provider switching, backfill, live file sync |
| `McpService` | MCP import/export, cross-app sync |
| `SkillService` | GitHub repo scanning, skill lifecycle |
| `PromptService` | Prompt preset activation |
| `ProxyService` | Local proxy server management |
| `SpeedtestService` | API endpoint latency measurement |
| `ConfigService` | Backup rotation, config migration |

### DAO (`src-tauri/src/database/dao/`)
| DAO | Entity |
|-----|--------|
| `providers.rs` | Provider records |
| `mcp.rs` | MCP server configs |
| `prompts.rs` | Prompt presets |
| `skills.rs` | Installed skills |
| `settings.rs` | App settings |
| `failover.rs` | Failover queue |
| `proxy.rs` | Proxy configuration |

---

## Frontend Architecture

```
Components ←→ Hooks ←→ TanStack Query ←→ API Layer ←→ Tauri IPC
```

### Key Hooks (`src/hooks/`)
| Hook | Purpose |
|------|---------|
| `useProviderActions` | Provider CRUD, switching |
| `useMcp` | MCP state & operations |
| `useSkills` | Skills discovery & install |
| `usePromptActions` | Prompt preset management |
| `useSettings` | App settings state |
| `useProxyStatus` | Proxy server status |
| `useImportExport` | Config backup/restore |
| `useDragSort` | Provider reordering |

### API Layer (`src/lib/api/`)
Type-safe wrappers for each command domain:
- `providers.ts`, `mcp.ts`, `skills.ts`, `prompts.ts`
- `proxy.ts`, `settings.ts`, `usage.ts`, `failover.ts`

### Query Layer (`src/lib/query/`)
- `queries.ts` - Query definitions with keys
- `mutations.ts` - Mutation hooks
- `queryClient.ts` - Client configuration

---

## Config Presets (`src/config/`)

| File | Content |
|------|---------|
| `claudeProviderPresets.ts` | Claude provider templates |
| `codexProviderPresets.ts` | Codex provider templates |
| `geminiProviderPresets.ts` | Gemini provider templates |
| `mcpPresets.ts` | MCP server templates |
| `universalProviderPresets.ts` | Cross-app provider presets |

---

## Proxy System (`src-tauri/src/proxy/`)

Local API proxy with:
- **Circuit Breaker**: `circuit_breaker.rs`
- **Failover**: `failover_switch.rs`
- **Provider Routing**: `provider_router.rs`
- **Model Mapping**: `model_mapper.rs`
- **Usage Tracking**: `usage/` (calculator, logger, parser)

---

## Database

- **Location**: `~/.cc-switch/cc-switch.db` (SQLite)
- **Schema**: `src-tauri/src/database/schema.rs`
- **Migrations**: `src-tauri/src/database/migration.rs`
- **Backup**: Auto-rotation, keep 10 most recent

---

## Testing

| Location | Framework | Coverage |
|----------|-----------|----------|
| `tests/hooks/` | vitest + MSW | 100% hooks |
| `tests/components/` | @testing-library/react | Key dialogs |
| `tests/integration/` | vitest | App flows |
| `src-tauri/` | cargo test | Backend units |

---

## Statistics

| Metric | Count |
|--------|-------|
| Frontend files (TS/TSX) | 192 |
| Backend files (Rust) | 114 |
| Test files | 23 |
| Backend LOC | ~40,600 |
| i18n Languages | 3 (zh/en/ja) |

---

## Quick Start

```bash
# Install dependencies
pnpm install

# Dev mode
pnpm dev

# Run frontend tests
pnpm test:unit

# Run backend tests
cd src-tauri && cargo test

# Build production
pnpm build
```

---

## Key Dependencies

| Frontend | Backend |
|----------|---------|
| React 18 | Tauri 2.8 |
| TanStack Query v5 | rusqlite |
| shadcn/ui (Radix) | tokio |
| react-hook-form + zod | axum |
| CodeMirror 6 | reqwest |
| @dnd-kit | serde |
| framer-motion | thiserror |

---

## Live Config Locations

| App | Config | MCP |
|-----|--------|-----|
| Claude | `~/.claude/settings.json` | `~/.claude.json` |
| Codex | `~/.codex/auth.json` | `~/.codex/config.toml` |
| Gemini | `~/.gemini/.env` | `~/.gemini/settings.json` |
