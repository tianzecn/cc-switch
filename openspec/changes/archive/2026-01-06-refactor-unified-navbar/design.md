# Design: Unified Navbar Refactor

## Context

CC Switch 应用当前的导航栏逻辑分散在 `App.tsx` 中，通过条件渲染处理不同页面的头部内容。随着功能增加（Skills、Commands、Hooks、Agents 等），导航逻辑变得复杂且难以维护。

**利益相关者**：
- 用户：期望一致的导航体验
- 开发者：期望可维护的代码结构

**约束**：
- 保持 Tauri 拖拽区域功能
- 不引入路由库
- 保持现有 `useState` 状态管理方案

## Goals / Non-Goals

### Goals
- 创建单一、可复用的 `UnifiedNavbar` 组件
- 提供一致的 3 行布局结构
- 支持响应式设计（窄屏时功能按钮隐藏文字）
- 保持现有功能完整性

### Non-Goals
- 引入 TanStack Router 或 React Router
- 更改 AppSwitcher 胶囊样式
- 将 Universal Providers 加入功能按钮行
- 添加键盘快捷键

## Decisions

### Decision 1: 单一组件 vs 拆分子组件

**选择**：单一 `UnifiedNavbar.tsx` 组件，不拆分子组件

**理由**：
- 3 行布局逻辑紧密相关，拆分反而增加复杂度
- 组件间数据传递会增加 props drilling
- 单一文件便于理解和维护

**替代方案**：
- 拆分为 `NavbarRow1.tsx`、`NavbarRow2.tsx`、`NavbarRow3.tsx` - 过度设计，增加文件管理成本

### Decision 2: 操作按钮管理方式

**选择**：通过 `pageActionRefs` props 传递 ref，由导航栏触发页面操作

**理由**：
- 保持现有的 ref 回调模式
- 不需要修改子页面的操作逻辑
- 导航栏只负责触发，具体逻辑在页面组件中

**替代方案**：
- 使用 Context 共享操作回调 - 增加复杂度
- 操作按钮留在页面内部 - 不符合统一导航栏设计目标

### Decision 3: 响应式断点

**选择**：768px 断点，使用 Tailwind CSS 媒体查询

**理由**：
- 768px 是常见的平板/桌面分界点
- Tailwind 已有 `md:` 前缀支持
- 与现有项目样式一致

### Decision 4: 空操作行处理

**选择**：保留空行作为占位符，保持导航栏高度一致

**理由**：
- 避免内容区域跳动
- 用户体验更稳定
- 实现简单（固定高度）

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 导航栏高度增加占用内容空间 | 中 | 采用紧凑的 32px 每行设计 |
| 各页面操作按钮逻辑复杂 | 低 | 通过 ref 回调机制处理 |
| i18n 文字长度差异导致布局问题 | 低 | 使用简短标签 + 响应式隐藏文字 |
| 重构范围大，可能引入 bug | 中 | 分阶段实现，充分测试 |

## Architecture

### 组件结构

```
src/components/
├── navbar/
│   └── UnifiedNavbar.tsx    # 统一导航栏组件
├── AppSwitcher.tsx          # 保持不变
├── proxy/
│   └── ProxyToggle.tsx      # 保持不变
└── UpdateBadge.tsx          # 保持不变
```

### Props 接口

```typescript
interface UnifiedNavbarProps {
  // 当前视图状态
  currentView: View;
  onViewChange: (view: View) => void;

  // 应用切换
  activeApp: AppId;
  onAppChange: (app: AppId) => void;

  // 第三行操作按钮的 ref
  pageActionRefs?: {
    promptPanel?: React.RefObject<PromptPanelRef>;
    mcpPanel?: React.RefObject<McpPanelRef>;
    skillsPage?: React.RefObject<SkillsPageRef>;
    unifiedSkillsPanel?: React.RefObject<UnifiedSkillsPanelRef>;
  };

  // 添加 Provider 回调
  onAddProvider: () => void;
}
```

### 布局示意

```
┌─────────────────────────────────────────────────────────────────┐
│  (28px 拖拽区 - Tauri drag region)                              │
├─────────────────────────────────────────────────────────────────┤
│  第一行 (32px): [标题区] | [设置] | [Proxy] | [AppSwitcher] | [+]│
├─────────────────────────────────────────────────────────────────┤
│  第二行 (32px): [Skills] [Commands] [Hooks] [Agents] [Prompts] [MCP]│
├─────────────────────────────────────────────────────────────────┤
│  第三行 (32px): [页面特定操作按钮...]                            │
└─────────────────────────────────────────────────────────────────┘
```

## Migration Plan

### 阶段 1：创建新组件
1. 创建 `src/components/navbar/UnifiedNavbar.tsx`
2. 实现 3 行布局结构
3. 集成现有组件（AppSwitcher、ProxyToggle、UpdateBadge）

### 阶段 2：集成到 App.tsx
1. 在 `App.tsx` 中引入 `UnifiedNavbar`
2. 移除现有的 `<header>` 代码
3. 调整内容区域的 padding

### 阶段 3：清理子页面
1. 移除各子页面的头部逻辑
2. 确保操作按钮通过 ref 正常工作
3. 测试所有导航路径

### 回滚方案
- 保留原有 `<header>` 代码注释
- 如发现严重问题，可快速恢复

## Open Questions

1. ~~是否需要添加导航栏的展开/收起功能？~~ - 不需要，保持固定高度
2. ~~第三行操作按钮是否需要分组？~~ - 不需要，保持平铺
