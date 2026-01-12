# Development Commands

## Requirements

- Node.js 18+
- pnpm 8+
- Rust 1.85+
- Tauri CLI 2.8+

## Frontend (repo root)

- `pnpm install` install dependencies
- `pnpm dev` run dev server with hot reload
- `pnpm build` build production frontend
- `pnpm typecheck` run TypeScript type checking
- `pnpm tauri build --debug` build a debug app bundle

## Backend (src-tauri)

- `cargo test` run backend tests
- `cargo test <test_name>` run a single backend test
- `cargo test --features test-hooks` run hook-related tests

Formatting and linting are handled via Biome/ESLint; prefer a Stop Hook in Claude Code.
