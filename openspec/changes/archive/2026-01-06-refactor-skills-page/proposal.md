# Change: Skills 页面重构为双栏布局并引入命名空间

## Why

当前 Skills 页面采用单栏网格布局，与 Commands/Hooks/Agents 页面的双栏布局（左侧树形导航 + 右侧列表）风格不一致。为了提供统一的用户体验，需要将 Skills 页面重构为与其他管理页面一致的布局结构。

同时，Skills 缺少命名空间概念，无法按逻辑分组管理，不利于组织大量 Skills。通过引入命名空间支持，可以实现三级结构（仓库 → 命名空间 → Skill），提升 Skills 的组织能力。

## What Changes

### 后端变更

- **数据库迁移**：为 `skills` 表添加 `namespace` 列（v7 迁移）
- **SSOT 目录重构**：将 `~/.cc-switch/skills/` 从扁平结构改为 `skills/namespace/skill-name` 层级结构
- **新增 API**：
  - `get_skill_namespaces()` - 获取所有命名空间列表
  - `create_skill_namespace(name)` - 创建新命名空间
  - `delete_skill_namespace(name)` - 删除空命名空间
  - `detect_skill_conflicts()` - 检测同名 Skill 冲突

### 前端变更

- **页面布局重构**：将 SkillsPage 改为双栏布局
  - 左侧：SkillNamespaceTree 组件（w-64）
  - 右侧：SkillsList 组件（flex-1）+ SkillDetailPanel（w-80，选中时显示）
- **组件合并**：将 UnifiedSkillsPanel 功能合并到 SkillsPage
- **新增组件**：
  - SkillNamespaceTree - 命名空间树组件（参考 Commands 的 NamespaceTree）
  - SkillsList - 列表组件
  - SkillListItem - 列表项组件（替代 SkillCard）
  - SkillDetailPanel - 详情面板组件
  - SkillConflictPanel - 冲突检测面板
- **新增 Hooks**：
  - useSkillNamespaces - 获取命名空间列表
  - useSkillConflicts - 获取冲突信息
  - useCreateSkillNamespace - 创建命名空间
  - useDeleteSkillNamespace - 删除命名空间

### 废弃/删除

- **UnifiedSkillsPanel.tsx** - 功能合并到 SkillsPage
- **SkillCard.tsx** - 改用 SkillListItem
- **RepoManagerPanel.tsx** - 功能集成到 SkillNamespaceTree

## Impact

- Affected specs: 无现有规格（新增 skills-management 规格）
- Affected code:
  - `src-tauri/src/database/schema.rs` (v7 迁移)
  - `src-tauri/src/database/dao/skills.rs`
  - `src-tauri/src/services/skill.rs`
  - `src-tauri/src/commands/skill.rs`
  - `src-tauri/src/app_config.rs` (InstalledSkill 结构)
  - `src/components/skills/` (主要重构区域)
  - `src/hooks/useSkills.ts`
  - `src/i18n/locales/` (新增翻译)
- **BREAKING**: 数据库迁移将重构 Skills SSOT 目录结构，现有 Skills 需要迁移
