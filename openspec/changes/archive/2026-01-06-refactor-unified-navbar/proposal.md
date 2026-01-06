# Change: Refactor Unified Navbar Component

## Why

当前 CC Switch 应用的导航结构分散在 `App.tsx` 和各子页面组件中，导致：
- 首页与子页面的头部布局不一致
- 导航逻辑重复，维护困难
- 用户体验不统一

本次重构旨在创建单一的 `UnifiedNavbar` 组件，提供一致的 3 行布局结构，统一管理所有页面的导航栏。

## What Changes

### 新增
- 创建 `UnifiedNavbar` 组件，包含 3 行布局：
  - 第一行：核心区（标题/返回 | 设置 | Proxy | AppSwitcher | +）
  - 第二行：功能按钮区（Skills | Commands | Hooks | Agents | Prompts | MCP）
  - 第三行：操作按钮区（页面特定操作）
- 功能按钮改为图标 + 文字，支持响应式（窄屏隐藏文字）
- 第三行操作按钮统一使用 `outline` 样式

### 修改
- **BREAKING**: `App.tsx` 移除现有的 `<header>` 导航逻辑，改用 `<UnifiedNavbar>`
- 各子页面组件移除各自的头部逻辑

### 影响的组件
- `src/App.tsx` - 主应用组件
- `src/components/skills/SkillsPage.tsx`
- `src/components/skills/UnifiedSkillsPanel.tsx`
- `src/components/commands/CommandsPage.tsx`
- `src/components/hooks/HooksPage.tsx`
- `src/components/agents/AgentsPage.tsx`
- `src/components/prompts/PromptPanel.tsx`
- `src/components/mcp/UnifiedMcpPanel.tsx`
- `src/components/settings/SettingsPage.tsx`
- `src/components/universal/UniversalProviderPanel.tsx`

## Impact

- **Affected specs**: `unified-navbar` (新增 capability)
- **Affected code**: `src/App.tsx`, `src/components/**/*Panel.tsx`, `src/components/**/*Page.tsx`
- **Breaking changes**: 导航栏高度从约 64px 增加到约 96px（不含拖拽区）
- **No data migration required**
