# Design: Responsive Layout System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Root                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    UnifiedNavbar                           │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │         NavbarContent (ContentContainer)             │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Page Content                            │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │         PageContainer (ContentContainer)             │  │  │
│  │  │                                                      │  │  │
│  │  │   [Cards, Lists, Forms, etc.]                        │  │  │
│  │  │                                                      │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### ContentContainer

统一的布局容器组件，封装宽度计算逻辑：

```
┌─────────────────────────────────────────────────────────────────┐
│                        ContentContainer                          │
├─────────────────────────────────────────────────────────────────┤
│ Props:                                                           │
│   - variant: "standard" | "wide"                                │
│   - className?: string                                           │
│   - children: ReactNode                                          │
├─────────────────────────────────────────────────────────────────┤
│ Behavior:                                                        │
│   - 读取 useLayoutMode() 获取当前布局模式                         │
│   - adaptive 模式: w-[95%] max-w-[1920px]                        │
│   - fixed 模式: max-w-[56rem] (standard) / max-w-[72rem] (wide) │
│   - 响应式内边距: px-4 sm:px-6 lg:px-8                           │
│   - 过渡动画: transition-[width,padding] duration-150            │
└─────────────────────────────────────────────────────────────────┘
```

### useLayoutMode Hook

基于 Zustand 的状态管理：

```
┌─────────────────────────────────────────────────────────────────┐
│                        useLayoutMode                             │
├─────────────────────────────────────────────────────────────────┤
│ State:                                                           │
│   - mode: "fixed" | "adaptive"                                  │
├─────────────────────────────────────────────────────────────────┤
│ Actions:                                                         │
│   - setMode(mode): void                                          │
│   - toggle(): void                                               │
├─────────────────────────────────────────────────────────────────┤
│ Persistence:                                                     │
│   - localStorage key: "cc-switch-layout-mode"                    │
│   - Default: "adaptive"                                          │
└─────────────────────────────────────────────────────────────────┘
```

## Width Strategy

### Adaptive Mode

```
viewport width
├───────────────────────────────────────────────────────────────────┤
│ 2.5% │              95% content area              │ 2.5% │
│      │         (max 1920px)                        │      │
├──────┼────────────────────────────────────────────┼──────┤

Examples:
- 1920px viewport → 1824px content (95%)
- 2560px viewport → 1920px content (capped at max)
- 1280px viewport → 1216px content (95%)
```

### Fixed Mode

```
viewport width
├───────────────────────────────────────────────────────────────────┤
│  auto │        896px / 1152px content         │  auto │
│       │           (centered)                    │       │
├───────┼────────────────────────────────────────┼───────┤
```

## Page Variants

| Page Type | Variant | Max Width (Fixed) | Use Case |
|-----------|---------|-------------------|----------|
| Providers | standard | 56rem (896px) | 单列卡片列表 |
| Settings | standard | 56rem | 表单页面 |
| Prompts | standard | 56rem | 编辑器页面 |
| MCP | standard | 56rem | 配置面板 |
| Skills | wide | 72rem (1152px) | 网格卡片 |
| Agents | wide | 72rem | 三列布局 |
| Commands | wide | 72rem | 三列布局 |
| Hooks | wide | 72rem | 三列布局 |

## Responsive Padding

```css
/* 断点式内边距 */
.content-padding {
  padding-left: 1rem;     /* 16px, default */
  padding-right: 1rem;
}

@media (min-width: 640px) {
  .content-padding {
    padding-left: 1.5rem;  /* 24px, sm+ */
    padding-right: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .content-padding {
    padding-left: 2rem;    /* 32px, lg+ */
    padding-right: 2rem;
  }
}
```

## Transition Animation

```css
.layout-transition {
  transition-property: width, max-width, padding-left, padding-right;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}
```

## Data Flow

```
┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│   Settings   │────▶│  useLayoutMode   │────▶│ ContentContainer  │
│   Page UI    │     │    (Zustand)     │     │   (all pages)     │
└──────────────┘     └──────────────────┘     └───────────────────┘
       │                     │                         │
       │                     ▼                         │
       │              ┌──────────────┐                 │
       │              │ localStorage │                 │
       │              │  (persist)   │                 │
       │              └──────────────┘                 │
       │                                               │
       └───────────────────────────────────────────────┘
                    Re-render on mode change
```

## Integration with Existing Components

### UnifiedNavbar

导航栏内容需要与页面内容对齐：

```tsx
// UnifiedNavbar.tsx
<nav className="w-full">
  <ContentContainer variant="standard">
    {/* navbar content */}
  </ContentContainer>
</nav>
```

### Multi-Column Pages (Agents, Commands, Hooks)

三列布局的中间列扩展：

```tsx
// AgentsPage.tsx
<ContentContainer variant="wide">
  <div className="flex gap-4">
    <aside className="w-64 flex-shrink-0">...</aside>
    <main className="flex-1">
      {/* 自适应模式下显示更多信息 */}
    </main>
    <aside className="w-72 flex-shrink-0">...</aside>
  </div>
</ContentContainer>
```

### MCP Panel

详情面板按比例变化：

```tsx
// UnifiedMcpPanel.tsx
const { mode } = useLayoutMode();
const detailWidth = mode === "adaptive"
  ? "w-[40%] min-w-[300px] max-w-[500px]"
  : "w-[400px]";
```

## Settings UI

```
┌─────────────────────────────────────────────────────────────┐
│  布局                                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  布局模式                                    ┌────────────┐ │
│  选择内容区域的宽度策略                       │ 自适应  ▼  │ │
│                                              └────────────┘ │
│                                                              │
│  选项:                                                       │
│  - 自适应: 内容区随窗口宽度变化                              │
│  - 固定宽度: 内容区保持固定最大宽度                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Trade-offs

| 方面 | 选择 | 替代方案 | 选择理由 |
|------|------|----------|----------|
| 状态管理 | Zustand + persist | React Context | Zustand 更轻量，persist 中间件开箱即用 |
| 宽度实现 | Tailwind 类名 | CSS 变量 | 与现有代码风格一致，易于维护 |
| 组件封装 | ContentContainer | HOC | 组件更直观，props 更清晰 |
| 过渡动画 | CSS transition | Framer Motion | 简单场景 CSS 足够，避免引入额外复杂度 |

## Backward Compatibility

- 固定模式保持与当前完全相同的宽度
- 用户切换到固定模式即可获得旧体验
- localStorage 清除后自动回到默认（自适应）
