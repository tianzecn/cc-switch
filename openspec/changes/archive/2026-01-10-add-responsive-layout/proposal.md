# Proposal: Add Responsive Layout System

## Summary

实现自适应比例布局系统，让内容区宽度随窗口变化而变化，提供「固定」和「自适应」两种布局模式供用户选择。

## Problem Statement

当前 CC Switch 应用使用固定最大宽度布局（`max-w-[56rem]` / `max-w-[72rem]`），存在以下问题：

1. **空间利用率低**：在 2K/4K 大屏显示器上，内容区只占中间一小块，两侧大量留白浪费
2. **缩放体验差**：调整窗口大小时，内容宽度不跟随变化，体验僵硬
3. **信息密度不足**：用户希望一屏展示更多内容，减少滚动

## Proposed Solution

引入响应式布局系统：

1. **自适应布局模式**（默认）：内容区宽度为 95% 视口宽度，最大 1920px
2. **固定布局模式**：保持原有 56rem/72rem 最大宽度
3. **用户可切换**：在设置页面提供布局模式切换选项
4. **统一布局组件**：创建 `ContentContainer` 组件封装布局逻辑

### Key Design Decisions

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 内容区比例 | 95% | 保留 2.5% 两侧边距，视觉舒适 |
| 最大宽度 | 1920px | 在 1080p 显示器上完全填满，更大屏幕略有留白 |
| 最小窗口宽度 | 900px | 确保基本布局不坍塌 |
| 默认模式 | 自适应 | 满足大多数用户对大屏的期望 |
| 状态存储 | localStorage | 纯前端偏好，无需同步到后端 |

## Scope

### In Scope

- 创建布局模式状态管理 Hook（`useLayoutMode`）
- 创建统一布局容器组件（`ContentContainer`）
- 添加 CSS 布局变量体系
- 更新所有页面使用新布局组件
- 在设置页面添加布局模式切换 UI
- 设置 Tauri 窗口最小宽度为 900px
- 添加窗口缩放过渡动画
- 添加 i18n 翻译（中/英/日）

### Out of Scope

- 用户自定义最大宽度（滑块输入）
- 按页面类型记住布局偏好
- 紧凑/标准/宽松三档密度选择
- 侧边栏可拖拽调整宽度

## Impact Analysis

### Files to Create

| 文件 | 用途 |
|------|------|
| `src/components/layout/ContentContainer.tsx` | 布局容器组件 |
| `src/hooks/useLayoutMode.ts` | 布局模式状态管理 |

### Files to Modify

| 文件 | 改动内容 |
|------|----------|
| `src/index.css` | 添加布局 CSS 变量 |
| `tailwind.config.cjs` | 添加布局相关配置 |
| `src-tauri/tauri.conf.json` | 设置最小窗口宽度 |
| `src/i18n/locales/*.json` | 添加翻译键 |
| 16 个页面组件 | 替换为 ContentContainer |

### Affected Specs

| Spec | 影响 |
|------|------|
| `unified-navbar` | 导航栏宽度策略变更 |

## Alternatives Considered

1. **纯 CSS 媒体查询**：不够灵活，无法让用户选择偏好
2. **CSS Container Queries**：浏览器兼容性限制
3. **只提供自适应模式**：部分用户可能偏好固定宽度的经典布局

## Risks and Mitigations

| 风险 | 缓解措施 |
|------|----------|
| 某些分辨率下布局异常 | 渐进式修复，发现问题逐步解决 |
| 用户不习惯新布局 | 提供切换选项，可回退到固定模式 |
| 过渡动画卡顿 | 限制动画属性，使用 GPU 加速 |

## References

- 源设计文档：[plans/responsive-layout-spec.md](../../plans/responsive-layout-spec.md)
