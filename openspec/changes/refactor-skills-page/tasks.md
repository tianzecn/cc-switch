# Tasks: Skills 页面重构

## 1. 后端数据模型 (Phase 1)

- [ ] 1.1 修改 `InstalledSkill` 结构，添加 `namespace: String` 字段 (`src-tauri/src/app_config.rs`)
- [ ] 1.2 编写 v6 -> v7 数据库迁移脚本 (`src-tauri/src/database/schema.rs`)
  - 添加 `namespace TEXT NOT NULL DEFAULT ''` 列到 skills 表
  - 创建索引 `idx_skills_namespace`
  - 迁移现有数据：从 directory 路径推断命名空间
- [ ] 1.3 更新 Skills DAO 层以处理 namespace 字段 (`src-tauri/src/database/dao/skills.rs`)
- [ ] 1.4 实现 SSOT 目录结构迁移逻辑 (`src-tauri/src/services/skill.rs`)
  - 从 `~/.cc-switch/skills/{skill}/` 迁移到 `~/.cc-switch/skills/{namespace}/{skill}/`
  - 根命名空间使用空字符串

## 2. 后端 API 扩展 (Phase 2)

- [ ] 2.1 实现 `get_skill_namespaces()` 命令 (`src-tauri/src/commands/skill.rs`)
- [ ] 2.2 实现 `create_skill_namespace(name)` 命令
- [ ] 2.3 实现 `delete_skill_namespace(name)` 命令
- [ ] 2.4 实现 `detect_skill_conflicts()` 命令
- [ ] 2.5 更新 `install_skill` 支持指定命名空间
- [ ] 2.6 编写后端单元测试

## 3. 前端 Hooks (Phase 3)

- [ ] 3.1 添加 `useSkillNamespaces` hook (`src/hooks/useSkills.ts`)
- [ ] 3.2 更新 `useInstalledSkills` 返回 namespace 字段
- [ ] 3.3 添加 `useCreateSkillNamespace` hook
- [ ] 3.4 添加 `useDeleteSkillNamespace` hook
- [ ] 3.5 添加 `useSkillConflicts` hook
- [ ] 3.6 添加前端 API 类型定义 (`src/lib/api/skills.ts`)

## 4. 核心组件开发 (Phase 4)

- [ ] 4.1 创建 `SkillNamespaceTree` 组件 (参考 `NamespaceTree.tsx`)
  - 仓库节点展开/折叠
  - 命名空间节点选择
  - 添加仓库按钮
  - 删除空命名空间
- [ ] 4.2 创建 `SkillsList` 组件
  - 列表渲染
  - 空状态提示
  - 加载状态
- [ ] 4.3 创建 `SkillListItem` 组件
  - 三应用开关 (Claude/Codex/Gemini)
  - 来源标签显示
  - 删除按钮
  - 选中状态高亮
- [ ] 4.4 创建 `SkillDetailPanel` 组件
  - README 预览
  - 文件列表
  - 在编辑器中打开
  - 元数据展示
- [ ] 4.5 创建 `SkillConflictPanel` 组件
  - 冲突列表展示
  - 解决建议
  - 可折叠/展开

## 5. 页面重构 (Phase 5)

- [ ] 5.1 重构 `SkillsPage` 为双栏布局
  - 参考 `CommandsPage.tsx` 实现
  - Container: `max-w-[72rem] h-[calc(100vh-8rem)]`
- [ ] 5.2 实现 Header 区域
  - 图标 + 标题 + 描述
  - 搜索框
  - 筛选器 (已安装/未安装/全部)
  - 操作按钮 (刷新/导入/发现)
- [ ] 5.3 实现 Stats Bar
  - 已安装数量
  - 各应用启用数量 (Claude/Codex/Gemini)
- [ ] 5.4 集成 ConflictDetectionPanel
- [ ] 5.5 实现 viewMode 切换逻辑 (list/discovery/import)
- [ ] 5.6 集成仓库管理到左侧树

## 6. App.tsx 集成 (Phase 6)

- [ ] 6.1 更新 App.tsx 中的 Skills 视图渲染逻辑
- [ ] 6.2 移除 UnifiedSkillsPanel 引用
- [ ] 6.3 更新 UnifiedNavbar 的 pageActionRefs (如需要)

## 7. 清理与优化 (Phase 7)

- [ ] 7.1 删除废弃的组件文件
  - `UnifiedSkillsPanel.tsx`
  - `SkillCard.tsx`
  - `RepoManagerPanel.tsx`
- [ ] 7.2 更新 i18n 翻译 (`src/i18n/locales/{zh,en,ja}/`)
  - 命名空间相关文案
  - 冲突检测相关文案
- [ ] 7.3 运行 `pnpm typecheck` 确保类型正确
- [ ] 7.4 运行 `pnpm format` 格式化代码
- [ ] 7.5 功能测试与 UI 验收

## 依赖关系

```
Phase 1 (数据模型)
    ↓
Phase 2 (API)
    ↓
Phase 3 (Hooks) ──┬─→ Phase 4 (组件)
                  ↓          ↓
              Phase 5 (页面重构)
                  ↓
              Phase 6 (集成)
                  ↓
              Phase 7 (清理)
```

## 并行可执行

- Phase 4 的各组件开发可并行进行
- Phase 7.2 (i18n) 可在 Phase 5 完成后独立进行
