# Proposal: Unify Module Header and Search Bar

## Change ID
`unify-module-header-searchbar`

## Summary

统一 Skills、Commands、Hooks、Agents 四个模块的 Header 按钮区和搜索行布局，实现一致的用户体验和交互模式。同时修复 Hooks/Agents 模块的国际化问题。

## Background

当前四个模块（Skills、Commands、Hooks、Agents）的 Header 按钮区和搜索行布局存在以下不一致问题：

1. **Header 按钮布局混乱**：各模块按钮顺序不统一，部分模块缺少必要按钮
2. **模式切换方式不一致**：已安装/发现模式的切换交互各不相同
3. **搜索行布局分散**：搜索框和统计信息分布在不同位置
4. **国际化不完善**：Hooks/Agents 模块存在硬编码文本

## Goals

1. 统一四个模块的 Header 按钮区设计和布局
2. 使用 Tabs 组件统一模式切换交互
3. 将搜索框和统计信息合并为一行
4. 修复所有国际化问题
5. 确保暗黑模式兼容性
6. 支持窄屏幕自动换行

## Non-Goals

- 不改变现有的业务逻辑
- 不修改树形导航组件
- 不改变列表项组件的样式
- 不涉及后端 API 变更

## Solution Overview

### 1. 统一 Header 布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [标题]                [已安装 | 发现] [仓库管理] [检查更新] [批量卸载]    │
│  ↑ 左侧固定           ↑ 右侧按钮区（Tabs + 操作按钮）                    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **已安装模式**：模式切换 Tabs → 仓库管理 → 检查更新 → 批量卸载
- **发现模式**：模式切换 Tabs → 仓库管理 → 刷新（无批量卸载和检查更新）

### 2. 统一搜索行布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [🔍 搜索框...]              [已安装 N 个]            [操作按钮]          │
└──────────────────────────────────────────────────────────────────────────┘
```

- **已安装模式**：搜索框 + "已安装 N 个"
- **发现模式**：搜索框 + "可用 N 个 · 已安装 N 个" + Install All

### 3. 模式切换组件

使用 shadcn/ui Tabs 组件，显示「已安装 | 发现」两个选项，下划线指示当前模式。

### 4. 国际化修复

添加缺失的翻译 key 到 zh.json、en.json、ja.json。

## Spec Deltas

1. **module-header-layout**: Header 按钮区统一规范
2. **module-searchbar-layout**: 搜索行统一规范
3. **i18n-completion**: 国际化完善规范

## Implementation Priority

1. Skills 模块（作为基准实现）
2. Commands 模块
3. Hooks 模块
4. Agents 模块

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| UI 变动影响用户习惯 | Medium | 统一设计提升整体一致性 |
| 组件复用可能增加复杂度 | Low | 使用 shadcn/ui 现有组件 |
| 暗黑模式兼容性问题 | Low | 使用 Tailwind dark: 前缀 |

## Dependencies

- shadcn/ui Tabs 组件
- 现有 i18n 基础设施
- TanStack Query 缓存机制

## Related Documents

- `plans/ui-header-searchbar-unification-spec.md` - 详细规格说明
- `openspec/specs/unified-navbar/spec.md` - 统一导航栏规范
- `openspec/specs/skills-management/spec.md` - Skills 管理规范
