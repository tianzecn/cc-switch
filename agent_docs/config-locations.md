# Config File Locations

## App Configs

| App       | Live Config                          | MCP Config                |
| --------- | ------------------------------------ | ------------------------- |
| Claude    | `~/.claude/settings.json`            | `~/.claude.json`          |
| Codex     | `~/.codex/auth.json` + `config.toml` | `~/.codex/config.toml`    |
| Gemini    | `~/.gemini/.env` + `settings.json`   | `~/.gemini/settings.json` |
| CC Switch | `~/.cc-switch/cc-switch.db`          | stored in DB              |

## CC Switch Storage

- Database (SSOT): `~/.cc-switch/cc-switch.db`
- Device settings: `~/.cc-switch/settings.json`
- Backups: `~/.cc-switch/backups/` (rotating)
