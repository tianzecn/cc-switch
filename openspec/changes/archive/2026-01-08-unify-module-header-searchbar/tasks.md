# Tasks: Unify Module Header and Search Bar

## Overview

实施顺序：Skills → Commands → Hooks → Agents

---

## Phase 1: Skills 模块 (基准实现)

### 1.1 重构 SkillsPageNew Header
- [ ] 移除已安装模式的刷新按钮
- [ ] 添加 Tabs 模式切换组件（已安装 | 发现）
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 检查更新 → 批量卸载
- [ ] 确保仓库管理按钮使用统一样式
- [ ] 验证暗黑模式显示

### 1.2 重构 Skills 搜索行
- [ ] 合并搜索框和统计信息为一行
- [ ] 已安装模式：搜索框 + "已安装 N 个"
- [ ] 实现响应式换行（flex-wrap）
- [ ] 验证窄屏幕自动换行

### 1.3 重构 Skills 发现模式 Header
- [ ] 移除返回按钮
- [ ] 使用 Tabs 切换回已安装模式
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 刷新
- [ ] 移除检查更新按钮

### 1.4 重构 Skills 发现模式搜索行
- [ ] 合并搜索框、统计信息、Install All 为一行
- [ ] 格式："可用 N 个 · 已安装 N 个" + Install All 按钮
- [ ] Install All 无可安装时显示禁用状态

---

## Phase 2: Commands 模块

### 2.1 重构 CommandsPage Header
- [ ] 移除已安装模式的刷新按钮
- [ ] 添加 Tabs 模式切换组件
- [ ] 添加仓库管理按钮
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 检查更新 → 批量卸载
- [ ] 验证暗黑模式显示

### 2.2 重构 Commands 搜索行
- [ ] 合并搜索框和统计信息为一行
- [ ] 移除独立的统计信息 Stats Bar
- [ ] 已安装模式：搜索框 + "已安装 N 个"
- [ ] 实现响应式换行

### 2.3 重构 CommandDiscovery Header
- [ ] 移除返回按钮
- [ ] 使用 Tabs 切换回已安装模式
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 刷新

### 2.4 重构 CommandDiscovery 搜索行
- [ ] 合并搜索框、统计信息、Install All 为一行
- [ ] 格式："可用 N 个 · 已安装 N 个" + Install All 按钮
- [ ] Install All 禁用状态处理

---

## Phase 3: Hooks 模块

### 3.1 重构 HooksPage Header
- [ ] 移除已安装模式的刷新按钮
- [ ] 添加 Tabs 模式切换组件
- [ ] 添加仓库管理按钮
- [ ] 添加检查更新按钮
- [ ] 添加批量卸载按钮
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 检查更新 → 批量卸载
- [ ] 验证暗黑模式显示

### 3.2 重构 Hooks 搜索行
- [ ] 合并搜索框和统计信息为一行
- [ ] 已安装模式：搜索框 + "已安装 N 个"
- [ ] 实现响应式换行

### 3.3 重构 HookDiscovery Header
- [ ] 移除返回按钮
- [ ] 使用 Tabs 切换回已安装模式
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 刷新

### 3.4 重构 HookDiscovery 搜索行
- [ ] 合并搜索框、统计信息、Install All 为一行
- [ ] 格式："可用 N 个 · 已安装 N 个" + Install All 按钮

---

## Phase 4: Agents 模块

### 4.1 重构 AgentsPage Header
- [ ] 移除已安装模式的刷新按钮
- [ ] 添加 Tabs 模式切换组件
- [ ] 添加仓库管理按钮
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 检查更新 → 批量卸载
- [ ] 验证暗黑模式显示

### 4.2 重构 Agents 搜索行
- [ ] 合并搜索框和统计信息为一行
- [ ] 已安装模式：搜索框 + "已安装 N 个"
- [ ] 实现响应式换行

### 4.3 重构 AgentDiscovery Header
- [ ] 移除返回按钮
- [ ] 使用 Tabs 切换回已安装模式
- [ ] 调整按钮顺序：模式切换 → 仓库管理 → 刷新

### 4.4 重构 AgentDiscovery 搜索行
- [ ] 合并搜索框、统计信息、Install All 为一行
- [ ] 格式："可用 N 个 · 已安装 N 个" + Install All 按钮

---

## Phase 5: 国际化修复

### 5.1 添加 common 翻译
- [ ] zh.json: 添加 `common.loadMore`
- [ ] en.json: 添加 `common.loadMore`
- [ ] ja.json: 添加 `common.loadMore`

### 5.2 添加 agents 翻译
- [ ] zh.json: 添加 `agents.comingSoon.title/description`
- [ ] zh.json: 添加 `agents.rootNamespace`, `agents.localAgents`
- [ ] zh.json: 添加 `agents.viewDocs`, `agents.openInEditor`, `agents.appUnsupported`
- [ ] zh.json: 添加 `agents.batch.*` 所有 key
- [ ] en.json: 添加对应英文翻译
- [ ] ja.json: 添加对应日文翻译

### 5.3 修复组件硬编码
- [ ] AgentsPanel.tsx: 使用 i18n key 替换硬编码
- [ ] GroupedAgentsList.tsx: 移除备选文本，使用纯 key
- [ ] BatchInstallAgentsButton.tsx: 移除备选文本，使用纯 key
- [ ] AgentListItem.tsx: 确保所有文本使用 i18n key

---

## Phase 6: 验收测试

### 6.1 视觉一致性测试
- [ ] 验证四个模块 Header 布局一致
- [ ] 验证四个模块搜索行布局一致
- [ ] 验证按钮顺序正确

### 6.2 功能测试
- [ ] 验证 Tabs 模式切换正常工作
- [ ] 验证各按钮功能正常
- [ ] 验证按钮禁用状态正确

### 6.3 响应式测试
- [ ] 验证 800px 宽度下搜索行自动换行
- [ ] 验证各模块在窄屏下显示正常

### 6.4 暗黑模式测试
- [ ] 验证四个模块在暗黑模式下显示正常
- [ ] 验证 Tabs 组件暗黑模式适配

### 6.5 国际化测试
- [ ] 验证中文显示正确
- [ ] 验证英文显示正确
- [ ] 验证日文显示正确

---

## Dependencies

- Phase 2 依赖 Phase 1 完成（以 Skills 为基准）
- Phase 3-4 可并行进行
- Phase 5 可与 Phase 2-4 并行进行
- Phase 6 依赖所有前置 Phase 完成

## Estimated Effort

| Phase | Estimated Time |
|-------|---------------|
| Phase 1 | 2-3h |
| Phase 2 | 1-2h |
| Phase 3 | 1-2h |
| Phase 4 | 1-2h |
| Phase 5 | 1h |
| Phase 6 | 1h |
| **Total** | **7-11h** |
