# Change: 内置仓库管理功能

## Why

当前用户新安装 CC Switch 后，需要手动添加官方和推荐的 Skills/Commands 仓库才能开始使用。这增加了上手门槛，且现有预置仓库列表已过时（包含不再维护的社区仓库），需要更新为官方推荐的仓库配置。

## What Changes

- **新增**：内置仓库配置文件（`src-tauri/resources/builtin-repos.json`）
- **新增**：数据库字段支持区分内置/用户仓库（`builtin`、`description_*`、`added_at`）
- **新增**：应用启动时自动同步内置仓库
- **新增**：仓库管理 UI 显示「内置」标签
- **新增**：「恢复默认仓库」功能
- **新增**：多语言仓库描述支持
- **修改**：删除仓库时检查内置标记，阻止删除内置仓库
- **移除**：旧的硬编码预置仓库（`ComposioHQ/awesome-claude-skills`、`cexll/myclaude`）

### 内置仓库列表

**Skills (3个):**
| 仓库 | 分支 |
|------|------|
| anthropics/skills | main |
| anthropics/claude-code | main |
| nextlevelbuilder/ui-ux-pro-max-skill | main |

**Commands (5个):**
| 仓库 | 分支 |
|------|------|
| anthropic-ai/claude-code | main |
| anthropics/claude-plugins-official | main |
| anthropics/claude-code | main |
| tianzecn/myclaudecode | main |
| tianzecn/SuperClaude | main |

## Impact

- Affected specs: `skills-management`（仓库管理）、新增 `commands-management`（仓库管理）
- Affected code:
  - `src-tauri/src/database/schema.rs`（数据库迁移）
  - `src-tauri/src/database/dao/skills.rs`（DAO 层）
  - `src-tauri/src/database/dao/commands.rs`（DAO 层）
  - `src-tauri/src/services/skill.rs`（服务层）
  - `src-tauri/src/services/command.rs`（服务层）
  - `src/components/skills/RepoManagerPanel.tsx`（UI）
  - `src/components/commands/CommandRepoManager.tsx`（UI）
  - `src/i18n/locales/*.json`（国际化）
