# 响应式布局改造方案

> **文档状态**: 待审核
> **创建日期**: 2026-01-10
> **目标版本**: v3.10.0

## 1. 概述

### 1.1 背景

当前 CC Switch 应用使用固定最大宽度布局（`max-w-[56rem]` / `max-w-[72rem]`），在大屏显示器上导致：

- 两侧大量留白，空间利用率低
- 窗口缩放时内容不跟随变化，体验僵硬
- 信息密度不足，需要更多滚动

### 1.2 目标

实现**自适应比例布局**，让内容区宽度随窗口变化而变化，同时提供布局模式切换功能。

### 1.3 核心指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| 内容区宽度 | 固定 896px / 1152px | **95% 视口宽度** |
| 最大宽度上限 | 无 | **1920px** |
| 最小窗口宽度 | (未明确) | **900px** |
| 布局模式 | 固定 | **可切换（固定/自适应）** |

---

## 2. 设计规范

### 2.1 宽度策略

```
┌─────────────────────────────────────────────────────────────┐
│                        视口宽度                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              内容区 (95% 或 max 1920px)              │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ←2.5%→                                           ←2.5%→    │
└─────────────────────────────────────────────────────────────┘
```

**计算公式**：
```css
width: min(95vw, 1920px);
/* 或等效的 */
width: 95%;
max-width: 1920px;
```

### 2.2 布局模式定义

| 模式 | 内容区宽度 | 适用场景 |
|------|-----------|----------|
| **固定** (Classic) | `max-w-[56rem]` / `max-w-[72rem]` | 偏好经典布局的用户 |
| **自适应** (Adaptive) | `w-[95%] max-w-[1920px]` | 希望充分利用屏幕的用户（默认） |

### 2.3 各区域行为规范

| 区域 | 固定模式 | 自适应模式 |
|------|----------|------------|
| **导航栏** | 全宽，内容居中对齐 max-w-[56rem] | 全宽，内容居中对齐 max-w-[1920px] |
| **Provider 列表** | 单列 max-w-[56rem] | 单列 95%/1920px，卡片变宽 |
| **Skills 网格** | 2-3 列 max-w-[72rem] | 2-3 列（保持断点），卡片变宽 |
| **Agents 三列** | 左 256px + 中 flex-1 + 右 288px | 同结构，中间列显示更多信息 |
| **MCP 面板** | 左列表 + 右详情固定 | 左列表 + 右详情按比例 |
| **Settings 表单** | 固定宽度 | 固定宽度（不变） |
| **Dialog 弹窗** | max-w-lg | max-w-lg（不变） |

### 2.4 内边距断点

| 断点 | 宽度范围 | 内边距 |
|------|----------|--------|
| 默认 | < 640px | `px-4` (16px) |
| sm | 640px - 1023px | `px-6` (24px) |
| lg | ≥ 1024px | `px-8` (32px) |

### 2.5 过渡动画

窗口缩放时添加微妙的 CSS transition：

```css
.layout-container {
  transition: width 150ms ease-out, padding 150ms ease-out;
}
```

---

## 3. 技术方案

### 3.1 CSS 变量体系

在 `src/index.css` 中定义布局变量：

```css
@layer base {
  :root {
    /* 布局模式: 'fixed' | 'adaptive' */
    --layout-mode: adaptive;

    /* 内容区宽度 */
    --content-max-width-fixed: 56rem;      /* 896px */
    --content-max-width-fixed-wide: 72rem; /* 1152px */
    --content-max-width-adaptive: 1920px;
    --content-width-percent: 95%;

    /* 最小宽度 */
    --app-min-width: 900px;

    /* 内边距（响应式由 Tailwind 处理） */
    --content-padding-sm: 1rem;    /* 16px */
    --content-padding-md: 1.5rem;  /* 24px */
    --content-padding-lg: 2rem;    /* 32px */
  }
}
```

### 3.2 Tailwind 配置扩展

在 `tailwind.config.cjs` 中添加自定义工具类：

```javascript
module.exports = {
  theme: {
    extend: {
      maxWidth: {
        'content': 'var(--content-max-width)',
        'content-fixed': '56rem',
        'content-fixed-wide': '72rem',
        'content-adaptive': '1920px',
      },
      width: {
        'content': 'var(--content-width)',
      },
    },
  },
  plugins: [
    // 布局模式插件
    function({ addUtilities }) {
      addUtilities({
        '.layout-fixed': {
          '--content-max-width': 'var(--content-max-width-fixed)',
          '--content-width': '100%',
        },
        '.layout-fixed-wide': {
          '--content-max-width': 'var(--content-max-width-fixed-wide)',
          '--content-width': '100%',
        },
        '.layout-adaptive': {
          '--content-max-width': 'var(--content-max-width-adaptive)',
          '--content-width': 'var(--content-width-percent)',
        },
      })
    }
  ],
};
```

### 3.3 布局容器组件

创建 `src/components/layout/ContentContainer.tsx`：

```tsx
import { cn } from "@/lib/utils";
import { useLayoutMode } from "@/hooks/useLayoutMode";

interface ContentContainerProps {
  children: React.ReactNode;
  className?: string;
  variant?: "standard" | "wide";
}

export function ContentContainer({
  children,
  className,
  variant = "standard",
}: ContentContainerProps) {
  const { mode } = useLayoutMode();

  const widthClasses = mode === "adaptive"
    ? "w-[95%] max-w-[1920px]"
    : variant === "wide"
      ? "max-w-[72rem]"
      : "max-w-[56rem]";

  return (
    <div
      className={cn(
        "mx-auto",
        widthClasses,
        // 响应式内边距
        "px-4 sm:px-6 lg:px-8",
        // 过渡动画
        "transition-[width,padding] duration-150 ease-out",
        className
      )}
    >
      {children}
    </div>
  );
}
```

### 3.4 布局模式 Hook

创建 `src/hooks/useLayoutMode.ts`：

```tsx
import { create } from "zustand";
import { persist } from "zustand/middleware";

type LayoutMode = "fixed" | "adaptive";

interface LayoutModeState {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  toggle: () => void;
}

export const useLayoutMode = create<LayoutModeState>()(
  persist(
    (set) => ({
      mode: "adaptive", // 默认自适应
      setMode: (mode) => set({ mode }),
      toggle: () =>
        set((state) => ({
          mode: state.mode === "fixed" ? "adaptive" : "fixed",
        })),
    }),
    {
      name: "cc-switch-layout-mode",
    }
  )
);
```

### 3.5 设置项 UI

在 Settings 页面添加布局模式切换：

```tsx
// 在 SettingsPage.tsx 中添加
<SettingItem
  label={t("settings.layout.mode")}
  description={t("settings.layout.modeDescription")}
>
  <Select value={layoutMode} onValueChange={setLayoutMode}>
    <SelectTrigger className="w-40">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="adaptive">
        {t("settings.layout.adaptive")}
      </SelectItem>
      <SelectItem value="fixed">
        {t("settings.layout.fixed")}
      </SelectItem>
    </SelectContent>
  </Select>
</SettingItem>
```

### 3.6 Tauri 窗口配置

更新 `src-tauri/tauri.conf.json`：

```json
{
  "app": {
    "windows": [
      {
        "minWidth": 900,
        "minHeight": 600
      }
    ]
  }
}
```

---

## 4. 文件改动清单

### 4.1 新增文件

| 文件路径 | 用途 |
|----------|------|
| `src/components/layout/ContentContainer.tsx` | 布局容器组件 |
| `src/hooks/useLayoutMode.ts` | 布局模式状态管理 |

### 4.2 修改文件

| 文件路径 | 改动内容 |
|----------|----------|
| `src/index.css` | 添加布局 CSS 变量 |
| `tailwind.config.cjs` | 添加布局相关配置 |
| `src-tauri/tauri.conf.json` | 设置最小窗口宽度 900px |
| `src/i18n/locales/zh.json` | 添加布局设置翻译 |
| `src/i18n/locales/en.json` | 添加布局设置翻译 |
| `src/i18n/locales/ja.json` | 添加布局设置翻译 |

### 4.3 页面组件改动

以下文件需要将 `mx-auto max-w-[56rem]` 或 `mx-auto max-w-[72rem]` 替换为 `ContentContainer`：

| 文件 | 当前宽度 | 变体 |
|------|----------|------|
| `src/App.tsx` | 56rem | standard |
| `src/components/settings/SettingsPage.tsx` | 56rem | standard |
| `src/components/prompts/PromptPanel.tsx` | 56rem | standard |
| `src/components/mcp/UnifiedMcpPanel.tsx` | 56rem | standard |
| `src/components/skills/SkillsPageNew.tsx` | 72rem | wide |
| `src/components/agents/AgentsPage.tsx` | 72rem | wide |
| `src/components/commands/CommandsPage.tsx` | 72rem | wide |
| `src/components/hooks/HooksPage.tsx` | 72rem | wide |
| `src/components/agents/AgentDiscovery.tsx` | 72rem | wide |
| `src/components/agents/AgentImport.tsx` | 72rem | wide |
| `src/components/commands/CommandDiscovery.tsx` | 72rem | wide |
| `src/components/commands/CommandImport.tsx` | 72rem | wide |
| `src/components/hooks/HookDiscovery.tsx` | 72rem | wide |
| `src/components/navbar/UnifiedNavbar.tsx` | 56rem | standard |
| `src/components/common/FullScreenPanel.tsx` | 56rem | standard |
| `src/components/providers/forms/BasicFormFields.tsx` | 56rem | standard |

---

## 5. 实施计划

### Phase 1: 基础设施（预计 1-2 小时）

1. [ ] 更新 `src/index.css` 添加 CSS 变量
2. [ ] 更新 `tailwind.config.cjs` 添加布局配置
3. [ ] 创建 `useLayoutMode` Hook
4. [ ] 创建 `ContentContainer` 组件
5. [ ] 更新 Tauri 窗口最小宽度配置

### Phase 2: 页面迁移（预计 2-3 小时）

按依赖顺序迁移：

1. [ ] `UnifiedNavbar.tsx` - 导航栏
2. [ ] `App.tsx` - 主入口
3. [ ] `SettingsPage.tsx` - 设置页（同时添加布局切换 UI）
4. [ ] `PromptPanel.tsx` - Prompts 面板
5. [ ] `UnifiedMcpPanel.tsx` - MCP 面板
6. [ ] `SkillsPageNew.tsx` - Skills 页面
7. [ ] `AgentsPage.tsx` - Agents 页面
8. [ ] `CommandsPage.tsx` - Commands 页面
9. [ ] `HooksPage.tsx` - Hooks 页面
10. [ ] Discovery/Import 页面（6 个文件）
11. [ ] `FullScreenPanel.tsx` - 全屏面板
12. [ ] `BasicFormFields.tsx` - 表单字段

### Phase 3: 细节优化（预计 1 小时）

1. [ ] 添加过渡动画
2. [ ] 调整卡片操作按钮显示逻辑
3. [ ] 添加 i18n 翻译
4. [ ] 验证各断点下的显示效果

### Phase 4: 测试验证（预计 30 分钟）

1. [ ] 验证 900px 最小宽度
2. [ ] 验证 1920px 最大宽度
3. [ ] 验证布局模式切换
4. [ ] 验证窗口缩放过渡效果
5. [ ] 验证暗色模式兼容性

---

## 6. 特殊处理

### 6.1 MCP 详情面板比例

MCP 页面的详情面板需要按比例变化：

```tsx
// UnifiedMcpPanel.tsx
const detailPanelWidth = mode === "adaptive"
  ? "w-[40%] min-w-[300px] max-w-[500px]"
  : "w-[400px]";
```

### 6.2 Agents 列表项信息扩展

当宽度充足时，显示更多信息：

```tsx
// AgentCard.tsx
const showExtendedInfo = containerWidth > 600;

return (
  <div>
    <span>{agent.name}</span>
    {showExtendedInfo && (
      <>
        <span>{agent.description}</span>
        <Tags tags={agent.tags} />
      </>
    )}
  </div>
);
```

### 6.3 卡片操作按钮显示阈值

当卡片宽度超过 500px 时始终显示操作按钮：

```tsx
// ProviderCard.tsx
const alwaysShowActions = cardWidth > 500;

<div className={cn(
  "flex items-center gap-2",
  alwaysShowActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
)}>
  {/* action buttons */}
</div>
```

---

## 7. 回滚方案

如果需要回滚：

1. 在设置中将默认布局模式改为 `fixed`
2. 或者直接在 `useLayoutMode.ts` 中硬编码 `mode: "fixed"`
3. 用户的布局偏好存储在 localStorage，清除 `cc-switch-layout-mode` 键即可重置

---

## 8. 未来扩展

以下功能不在本次范围内，但架构上预留支持：

- [ ] 用户自定义最大宽度（滑块输入）
- [ ] 按页面类型记住布局偏好
- [ ] 紧凑/标准/宽松三档密度选择
- [ ] 侧边栏可拖拽调整宽度

---

## 9. 验收标准

- [ ] 自适应模式下，内容区宽度为 95% 视口宽度（最大 1920px）
- [ ] 固定模式下，内容区宽度保持原有 56rem/72rem
- [ ] 窗口最小宽度限制为 900px
- [ ] 布局模式可在设置中切换，切换后立即生效
- [ ] 窗口缩放时有平滑过渡动画
- [ ] 所有页面布局一致
- [ ] 表单和弹窗保持固定宽度
- [ ] 暗色模式正常工作

---

## 附录 A: 当前布局代码位置

```
src/App.tsx:423                    mx-auto max-w-[56rem]
src/App.tsx:429                    mx-auto max-w-[56rem]
src/components/skills/SkillsPageNew.tsx:600    mx-auto max-w-[72rem]
src/components/mcp/UnifiedMcpPanel.tsx:144     mx-auto max-w-[56rem]
src/components/agents/AgentImport.tsx:116      mx-auto max-w-[72rem]
src/components/navbar/UnifiedNavbar.tsx:363   mx-auto max-w-[56rem]
src/components/commands/CommandImport.tsx:117  mx-auto max-w-[72rem]
src/components/agents/AgentDiscovery.tsx:188   mx-auto max-w-[72rem]
src/components/commands/CommandDiscovery.tsx:220 mx-auto max-w-[72rem]
src/components/settings/SettingsPage.tsx:201   mx-auto max-w-[56rem]
src/components/prompts/PromptPanel.tsx:99      mx-auto max-w-[56rem]
src/components/commands/CommandsPage.tsx:516   mx-auto max-w-[72rem]
src/components/agents/AgentsPage.tsx:479       mx-auto max-w-[72rem]
src/components/hooks/HooksPage.tsx:276         mx-auto max-w-[72rem]
src/components/common/FullScreenPanel.tsx:69   mx-auto max-w-[56rem]
src/components/common/FullScreenPanel.tsx:85   mx-auto max-w-[56rem]
src/components/common/FullScreenPanel.tsx:96   mx-auto max-w-[56rem]
src/components/hooks/HookDiscovery.tsx:156     mx-auto max-w-[72rem]
src/components/providers/forms/BasicFormFields.tsx:81  mx-auto max-w-[56rem]
src/components/providers/forms/BasicFormFields.tsx:95  mx-auto max-w-[56rem]
```

---

## 附录 B: i18n 翻译键

```json
// zh.json
{
  "settings": {
    "layout": {
      "title": "布局",
      "mode": "布局模式",
      "modeDescription": "选择内容区域的宽度策略",
      "adaptive": "自适应",
      "adaptiveDescription": "内容区随窗口宽度变化",
      "fixed": "固定宽度",
      "fixedDescription": "内容区保持固定最大宽度"
    }
  }
}

// en.json
{
  "settings": {
    "layout": {
      "title": "Layout",
      "mode": "Layout Mode",
      "modeDescription": "Choose the width strategy for content area",
      "adaptive": "Adaptive",
      "adaptiveDescription": "Content area adapts to window width",
      "fixed": "Fixed Width",
      "fixedDescription": "Content area maintains fixed maximum width"
    }
  }
}

// ja.json
{
  "settings": {
    "layout": {
      "title": "レイアウト",
      "mode": "レイアウトモード",
      "modeDescription": "コンテンツ領域の幅戦略を選択",
      "adaptive": "アダプティブ",
      "adaptiveDescription": "コンテンツ領域がウィンドウ幅に追従",
      "fixed": "固定幅",
      "fixedDescription": "コンテンツ領域が固定の最大幅を維持"
    }
  }
}
```
