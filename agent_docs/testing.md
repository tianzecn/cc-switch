# Testing Guide

## Frameworks

- vitest + MSW (Mock Service Worker)
- @testing-library/react

## Locations

- `tests/hooks/` hook unit tests
- `tests/components/` integration tests
- `src-tauri/` backend tests (cargo)

## Commands

- `pnpm test:unit` run all frontend tests
- `pnpm test:unit:watch` run frontend tests in watch mode
- `cargo test` run backend tests
- `cargo test --features test-hooks` run hook-specific backend tests

For detailed coverage or scenarios, see `docs/` and OpenSpec specs.
