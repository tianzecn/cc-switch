# Design: Unify Module Header and Search Bar

## Architecture Overview

本变更涉及前端 UI 层的统一重构，不涉及后端 API 或数据层变更。

```
┌─────────────────────────────────────────────────────────────┐
│                     Unified Components                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ ModeSwitchTabs  │  │ UnifiedHeader   │  │ SearchRow   │ │
│  │ (Tabs 样式切换)  │  │ (Header 容器)   │  │ (搜索+统计) │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Module Pages                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Skills   │  │ Commands │  │  Hooks   │  │  Agents  │   │
│  │ PageNew  │  │   Page   │  │   Page   │  │   Page   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Header 布局结构

```tsx
// Header 组件结构
<div className="flex items-center justify-between py-4">
  {/* 左侧：图标 + 标题 */}
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br ...">
      <Icon size={20} className="text-white" />
    </div>
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  </div>

  {/* 右侧：模式切换 + 操作按钮 */}
  <div className="flex items-center gap-2">
    <ModeSwitchTabs mode={viewMode} onModeChange={setViewMode} />
    <Button>仓库管理</Button>
    {viewMode === "list" ? (
      <>
        <CheckUpdatesButton />
        <Button>批量卸载</Button>
      </>
    ) : (
      <Button>刷新</Button>
    )}
  </div>
</div>
```

### 2. ModeSwitchTabs 组件

使用 shadcn/ui 的 Tabs 组件：

```tsx
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ModeSwitchTabsProps {
  mode: "list" | "discovery";
  onModeChange: (mode: "list" | "discovery") => void;
}

export const ModeSwitchTabs: React.FC<ModeSwitchTabsProps> = ({
  mode,
  onModeChange,
}) => {
  const { t } = useTranslation();

  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as "list" | "discovery")}>
      <TabsList className="h-8">
        <TabsTrigger value="list" className="text-xs px-3">
          {t("common.installed")}
        </TabsTrigger>
        <TabsTrigger value="discovery" className="text-xs px-3">
          {t("common.discover")}
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
};
```

### 3. SearchRow 组件结构

```tsx
// 搜索行组件结构
<div className="flex flex-wrap items-center gap-3 py-3">
  {/* 搜索框 */}
  <div className="relative flex-1 min-w-[200px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2" />
    <Input placeholder={placeholder} className="pl-9" />
  </div>

  {/* 统计信息 */}
  <div className="text-sm text-muted-foreground whitespace-nowrap">
    {statsText}
  </div>

  {/* 操作按钮（发现模式） */}
  {showInstallAll && (
    <Button disabled={!canInstall}>
      Install All
    </Button>
  )}
</div>
```

### 4. 响应式设计

使用 `flex-wrap` 实现窄屏自动换行：

```css
/* 搜索行响应式 */
.search-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

/* 搜索框最小宽度 */
.search-input {
  flex: 1;
  min-width: 200px;
}
```

## State Management

### 视图模式状态

各模块页面维护独立的 `viewMode` 状态：

```tsx
type ViewMode = "list" | "discovery";
const [viewMode, setViewMode] = useState<ViewMode>("list");
```

模式切换时：
- **list → discovery**：切换到发现模式组件
- **discovery → list**：返回已安装列表

### 按钮禁用状态

| 按钮 | 禁用条件 |
|-----|---------|
| 批量卸载 | `filteredItems.length === 0` |
| 检查更新 | `filteredItems.length === 0 \|\| isLoading` |
| Install All | `uninstalledCount === 0 \|\| isInstalling` |

## I18n Design

### 新增翻译 Key 结构

```json
{
  "common": {
    "installed": "已安装",
    "discover": "发现",
    "loadMore": "加载更多"
  },
  "agents": {
    "comingSoon": {
      "title": "即将推出",
      "description": "..."
    },
    "rootNamespace": "根",
    "localAgents": "本地 Agents",
    "viewDocs": "查看文档",
    "openInEditor": "在编辑器中打开",
    "appUnsupported": "应用不支持",
    "batch": {
      "installing": "安装中...",
      "currentAgent": "正在安装: {{name}}",
      "failedCount": "{{count}} 个失败",
      "installAll": "全部安装",
      "progress": "安装中 {{current}}/{{total}}"
    }
  }
}
```

## Dark Mode Support

使用 Tailwind CSS 的 dark mode 变体：

```tsx
// 统计信息文字
<span className="text-muted-foreground">
  {/* muted-foreground 自动适配暗黑模式 */}
</span>

// 按钮样式
<Button variant="outline">
  {/* outline variant 自动适配暗黑模式 */}
</Button>
```

## Migration Strategy

1. **Phase 1**: 在 Skills 模块实现统一布局作为基准
2. **Phase 2**: 复用代码到 Commands 模块
3. **Phase 3**: 复用代码到 Hooks 模块
4. **Phase 4**: 复用代码到 Agents 模块
5. **Phase 5**: 修复所有国际化问题
6. **Phase 6**: 验收测试

## Trade-offs

### 方案 A：抽取共享组件
- **优点**：代码复用，维护方便
- **缺点**：增加抽象层，各模块可能有细微差异

### 方案 B：直接修改各模块（选择此方案）
- **优点**：灵活性高，便于调整各模块差异
- **缺点**：代码重复度较高

**选择方案 B 的原因**：四个模块虽然布局统一，但具体按钮和业务逻辑有差异，直接修改更灵活。共享的只是设计规范和样式类名。

## Testing Strategy

1. **视觉测试**：验证四个模块的 Header 和搜索行布局一致
2. **功能测试**：验证模式切换、按钮禁用状态正确
3. **响应式测试**：验证窄屏幕下自动换行
4. **暗黑模式测试**：验证所有元素在暗黑模式下显示正常
5. **国际化测试**：验证 zh/en/ja 三种语言显示正确
