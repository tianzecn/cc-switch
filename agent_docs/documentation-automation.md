# Documentation Automation

## Responsibilities

| Document                 | Purpose                    | When to Update                   |
| ------------------------ | -------------------------- | -------------------------------- |
| `docs/architecture.md`   | System architecture design | When architecture changes        |
| `CHANGELOG.md`           | Release history            | After feature/bugfix completion  |
| `docs/project-status.md` | Progress and next steps    | End of each session              |
| `CLAUDE.md`              | Project entry guidance     | After major architecture changes |

## Trigger Conditions

- After completing significant development work
- After OpenSpec changes are archived
- Before ending a session
- Before `git commit` when features change
- When the user explicitly asks

## Format Conventions

- `CHANGELOG.md` follows Keep a Changelog (Added/Changed/Fixed/Removed)
- `docs/project-status.md` includes recent work, in-progress items, next steps, and technical debt
- `docs/architecture.md` includes diagrams, module responsibilities, and ADRs
