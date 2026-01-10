# Tasks: Add Responsive Layout System

## Phase 1: Infrastructure

### Task 1.1: Create useLayoutMode Hook
- [x] 创建 `src/hooks/useLayoutMode.ts`
- [x] 实现 Zustand store，包含 mode、setMode、toggle
- [x] 添加 persist 中间件，存储到 localStorage
- [x] 默认值设为 "adaptive"
- **验证**: 在 React DevTools 中确认状态可切换和持久化

### Task 1.2: Create ContentContainer Component
- [x] 创建 `src/components/layout/ContentContainer.tsx`
- [x] 实现 variant prop（standard/wide）
- [x] 根据 useLayoutMode 计算宽度类名
- [x] 添加响应式内边距（px-4 sm:px-6 lg:px-8）
- [x] 添加过渡动画类名
- [x] 创建 `src/components/layout/index.ts` 导出
- **验证**: 组件在两种模式下显示正确宽度

### Task 1.3: Update CSS Variables
- [x] 在 `src/index.css` 的 `:root` 中添加布局变量
- [x] 添加 `--content-max-width-fixed: 56rem`
- [x] 添加 `--content-max-width-fixed-wide: 72rem`
- [x] 添加 `--content-max-width-adaptive: 1920px`
- [x] 添加 `--content-width-percent: 95%`
- **验证**: CSS 变量在浏览器 DevTools 中可见

### Task 1.4: Update Tauri Window Config
- [x] 修改 `src-tauri/tauri.conf.json`
- [x] 设置 `minWidth: 900`
- [x] 确认 `minHeight` 合理（建议 600）
- **验证**: 应用窗口无法缩小到 900px 以下

## Phase 2: Page Migration

### Task 2.1: Migrate UnifiedNavbar
- [x] 在 `src/components/navbar/UnifiedNavbar.tsx` 中引入 ContentContainer
- [x] 替换 `mx-auto max-w-[56rem]` 为 ContentContainer
- [x] 确保导航栏内容与页面对齐
- **验证**: 导航栏宽度随模式变化

### Task 2.2: Migrate App.tsx
- [x] 替换两处 `mx-auto max-w-[56rem]` 为 ContentContainer
- **验证**: 主页内容区宽度正确

### Task 2.3: Migrate Settings Page
- [x] 在 `SettingsPage.tsx` 替换布局类名
- [x] 添加布局模式设置项 UI（Switch 组件）
- [x] 连接 useLayoutMode hook
- **验证**: 设置页面可切换布局模式

### Task 2.4: Migrate Standard Variant Pages
依次迁移以下页面（variant="standard"）：
- [x] `PromptPanel.tsx`
- [x] `UnifiedMcpPanel.tsx`
- [x] `FullScreenPanel.tsx`（3 处）
- [x] `BasicFormFields.tsx`（2 处）- **跳过：对话框内容保持固定宽度**
- **验证**: 各页面在两种模式下显示正确

### Task 2.5: Migrate Wide Variant Pages
依次迁移以下页面（variant="wide"）：
- [x] `SkillsPageNew.tsx`
- [x] `AgentsPage.tsx`
- [x] `CommandsPage.tsx`
- [x] `HooksPage.tsx`
- [x] `AgentDiscovery.tsx`
- [x] `AgentImport.tsx`
- [x] `CommandDiscovery.tsx`
- [x] `CommandImport.tsx`
- [x] `HookDiscovery.tsx`
- **验证**: 各页面在两种模式下显示正确

## Phase 3: i18n

### Task 3.1: Add Chinese Translations
- [x] 在 `src/i18n/locales/zh.json` 添加：
  - `settings.layout.title`: "布局模式"
  - `settings.layout.description`: "切换固定宽度或自适应布局"
  - `settings.layout.adaptive`: "自适应"
  - `settings.layout.fixed`: "固定"
- **验证**: 中文界面显示正确

### Task 3.2: Add English Translations
- [x] 在 `src/i18n/locales/en.json` 添加对应翻译
- **验证**: 英文界面显示正确

### Task 3.3: Add Japanese Translations
- [x] 在 `src/i18n/locales/ja.json` 添加对应翻译
- **验证**: 日文界面显示正确

## Phase 4: Verification

### Task 4.1: Manual Testing
- [ ] 测试自适应模式下 1920px 上限
- [ ] 测试固定模式下宽度保持
- [ ] 测试窗口缩放过渡动画
- [ ] 测试最小窗口宽度 900px
- [ ] 测试设置切换即时生效
- [ ] 测试 localStorage 持久化
- [ ] 测试暗色模式兼容性

### Task 4.2: Cross-Page Consistency Check
- [ ] 检查所有页面导航栏与内容对齐
- [ ] 检查所有页面边距一致
- [ ] 检查弹窗宽度不变

## Dependencies

```
Task 1.1 ──┐
           ├──▶ Task 2.x (all page migrations)
Task 1.2 ──┤
           │
Task 1.3 ──┘

Task 1.4 (parallel, no dependency)

Task 3.x ◀── Task 2.3 (需要 Settings UI 完成)

Task 4.x ◀── All Phase 1-3 tasks
```

## Parallelizable Work

- Task 1.1, 1.2, 1.3, 1.4 可并行
- Task 2.4 和 2.5 中的各页面迁移可并行
- Task 3.1, 3.2, 3.3 可并行

## Estimated Effort

| Phase | 预估时间 |
|-------|----------|
| Phase 1: Infrastructure | 1-2 小时 |
| Phase 2: Page Migration | 2-3 小时 |
| Phase 3: i18n | 30 分钟 |
| Phase 4: Verification | 30 分钟 |
| **Total** | **4-6 小时** |

## Implementation Notes

### Dependencies Added
- `zustand` v5.0.9 - 用于布局模式状态管理

### Files Created
- `src/hooks/useLayoutMode.ts` - Zustand store
- `src/components/layout/ContentContainer.tsx` - 布局容器组件
- `src/components/layout/index.ts` - 导出索引

### Files Modified
- `src/index.css` - CSS 变量
- `src-tauri/tauri.conf.json` - 窗口配置
- `src/components/navbar/UnifiedNavbar.tsx`
- `src/App.tsx`
- `src/components/settings/SettingsPage.tsx` - 添加布局设置 UI
- `src/components/mcp/UnifiedMcpPanel.tsx`
- `src/components/prompts/PromptPanel.tsx`
- `src/components/common/FullScreenPanel.tsx`
- `src/components/skills/SkillsPageNew.tsx`
- `src/components/agents/AgentsPage.tsx`
- `src/components/agents/AgentDiscovery.tsx`
- `src/components/agents/AgentImport.tsx`
- `src/components/commands/CommandsPage.tsx`
- `src/components/commands/CommandDiscovery.tsx`
- `src/components/commands/CommandImport.tsx`
- `src/components/hooks/HooksPage.tsx`
- `src/components/hooks/HookDiscovery.tsx`
- `src/i18n/locales/zh.json`
- `src/i18n/locales/en.json`
- `src/i18n/locales/ja.json`
