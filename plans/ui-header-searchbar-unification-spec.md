# UI 界面统一规范：Header 按钮区与搜索行整合

## 概述

本规格说明描述 Skills、Commands、Hooks、Agents 四个模块的 UI 统一改进方案，包括：
1. 统一 Header 按钮区设计
2. 搜索行布局整合
3. 国际化问题修复

**优先级顺序**：Skills → Commands → Hooks → Agents

---

## 通用设计规范

### 1. Header 布局结构

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [标题]                [已安装 | 发现] [仓库管理] [检查更新] [批量卸载]    │
│  ↑ 左侧固定           ↑ 右侧按钮区（Tabs + 操作按钮）                    │
└──────────────────────────────────────────────────────────────────────────┘
```

- **标题**：位于最左侧（如 "Skills"、"Commands" 等）
- **右侧按钮区**：模式切换 Tabs + 所有操作按钮
- **布局方式**：标题在左，其余全部在右侧，中间 flex-grow 撑开

### 2. 模式切换组件

- **组件类型**：shadcn/ui `Tabs` 组件
- **样式**：下划线指示当前选中的标签页
- **选项**：
  - `已安装`（对应 i18n key: `common.installed`）
  - `发现`（对应 i18n key: `common.discover` 或 `{module}.discover`）
- **位置**：右侧按钮区的最左边

### 3. 按钮顺序规范

**已安装模式**（从左到右）：
1. 模式切换 Tabs `[已安装 | 发现]`
2. 仓库管理
3. 检查更新
4. 批量卸载

**发现模式**（从左到右）：
1. 模式切换 Tabs `[已安装 | 发现]`
2. 仓库管理
3. 刷新

### 4. 按钮状态规范

| 按钮 | 空状态处理 | 加载状态 |
|-----|----------|---------|
| 批量卸载 | 禁用（无已安装项时） | 显示 spinner |
| 检查更新 | 禁用（无已安装项时） | 显示 spinner |
| Install All | 禁用（无可安装项时） | 显示 spinner |
| 刷新 | 始终可用 | 显示 spinner |
| 仓库管理 | 始终可用 | - |

### 5. 搜索行布局

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [🔍 搜索框...]              [已安装 N 个]            [操作按钮]          │
│  ↑ 左侧扩展                  ↑ 统计信息              ↑ 右侧操作          │
└──────────────────────────────────────────────────────────────────────────┘
```

**已安装模式**：
- 搜索框（flex-1 占据剩余空间）
- 统计信息："已安装 N 个"
- 无额外操作按钮

**发现模式**：
- 搜索框（flex-1）
- 统计信息："可用 N 个 · 已安装 N 个"
- Install All 按钮

### 6. 响应式设计

- **窄屏幕（< 800px）**：搜索行自动换行为两行
- **使用 `flex-wrap: wrap`** 实现自动换行
- **暗黑模式**：使用 shadcn/ui 组件自动兼容

### 7. 搜索框样式统一

- 四个模块使用完全一致的搜索框样式
- 宽度、高度、圆角、占位符样式统一
- 统一使用相同的 i18n key 格式

---

## 模块具体需求

### 一、Skills 模块

#### 当前问题
1. 已安装页面：批量卸载不在检查更新后面
2. 已安装页面：有不需要的刷新按钮
3. 发现模式：有不需要的检查更新按钮
4. Header 与发现模式未统一

#### 修改内容

**已安装模式 Header**：
```
Skills    [已安装 | 发现]  [仓库管理]  [检查更新]  [批量卸载]
```

**发现模式 Header**：
```
Skills    [已安装 | 发现]  [仓库管理]  [刷新]
```

**搜索行（已安装模式）**：
```
[🔍 搜索 Skills...]                              已安装 N 个
```

**搜索行（发现模式）**：
```
[🔍 搜索 Skills...]              可用 N 个 · 已安装 N 个    [Install All]
```

---

### 二、Commands 模块

#### 当前问题
1. 已安装页面：搜索框、已安装和变更检测不在一行
2. 已安装页面：有不需要的刷新按钮
3. 已安装页面：缺少仓库管理按钮
4. 发现模式和已安装页面 Header 未统一
5. 发现模式：搜索框和统计信息、Install All 未合并为一行

#### 修改内容

**已安装模式 Header**：
```
Commands    [已安装 | 发现]  [仓库管理]  [检查更新]  [批量卸载]
```

**发现模式 Header**：
```
Commands    [已安装 | 发现]  [仓库管理]  [刷新]
```

**搜索行（已安装模式）**：
```
[🔍 搜索 Commands...]                              已安装 N 个
```

**搜索行（发现模式）**：
```
[🔍 搜索 Commands...]              可用 N 个 · 已安装 N 个    [Install All]
```

---

### 三、Hooks 模块

#### 当前问题
1. 国际化未完善（见下文详细列表）
2. Header 按钮区未统一
3. 搜索框布局未整合

#### 修改内容

**已安装模式 Header**：
```
Hooks    [已安装 | 发现]  [仓库管理]  [检查更新]  [批量卸载]
```

**发现模式 Header**：
```
Hooks    [已安装 | 发现]  [仓库管理]  [刷新]
```

**搜索行（已安装模式）**：
```
[🔍 搜索 Hooks...]                              已安装 N 个
```

**搜索行（发现模式）**：
```
[🔍 搜索 Hooks...]              可用 N 个 · 已安装 N 个    [Install All]
```

---

### 四、Agents 模块

#### 当前问题
1. 国际化未完善（见下文详细列表）
2. Header 按钮区未统一
3. 搜索框布局未整合

#### 修改内容

**已安装模式 Header**：
```
Agents    [已安装 | 发现]  [仓库管理]  [检查更新]  [批量卸载]
```

**发现模式 Header**：
```
Agents    [已安装 | 发现]  [仓库管理]  [刷新]
```

**搜索行（已安装模式）**：
```
[🔍 搜索 Agents...]                              已安装 N 个
```

**搜索行（发现模式）**：
```
[🔍 搜索 Agents...]              可用 N 个 · 已安装 N 个    [Install All]
```

---

## 国际化问题修复清单

### Agents 模块国际化问题

#### AgentsPanel.tsx
| 行号 | 硬编码内容 | 需添加的 i18n key |
|-----|----------|------------------|
| 14 | "Coming Soon" | `agents.comingSoon.title` |
| 17 | "The Agents management feature..." | `agents.comingSoon.description` |

#### GroupedAgentsList.tsx
| 行号 | 硬编码内容 | 需确保存在的 i18n key |
|-----|----------|---------------------|
| 121 | "Root" | `agents.rootNamespace` |
| 127 | "Local Agents" | `agents.localAgents` |
| 304 | "Load more" | `common.loadMore` |

#### BatchInstallAgentsButton.tsx
| 行号 | 需确保存在的 i18n key |
|-----|---------------------|
| 53 | `agents.batch.installing` |
| 66 | `agents.batch.currentAgent` |
| 75 | `agents.batch.failedCount` |
| 90 | `common.cancel` |
| 106 | `agents.batch.installAll` |
| 142 | `agents.batch.progress` |

#### AgentListItem.tsx
| 行号 | 需确保存在的 i18n key |
|-----|---------------------|
| 95 | `agents.viewDocs` |
| 114 | `agents.openInEditor` |
| 222 | `agents.appUnsupported` |

### 翻译文件需添加的 key

**zh.json** 需添加：
```json
{
  "common": {
    "loadMore": "加载更多"
  },
  "agents": {
    "comingSoon": {
      "title": "即将推出",
      "description": "Agents 管理功能正在开发中，敬请期待强大的自主能力。"
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

**en.json** 需添加：
```json
{
  "common": {
    "loadMore": "Load more"
  },
  "agents": {
    "comingSoon": {
      "title": "Coming Soon",
      "description": "The Agents management feature is currently under development. Stay tuned for powerful autonomous capabilities."
    },
    "rootNamespace": "Root",
    "localAgents": "Local Agents",
    "viewDocs": "View Docs",
    "openInEditor": "Open in Editor",
    "appUnsupported": "App Unsupported",
    "batch": {
      "installing": "Installing...",
      "currentAgent": "Installing: {{name}}",
      "failedCount": "{{count}} failed",
      "installAll": "Install All",
      "progress": "Installing {{current}}/{{total}}"
    }
  }
}
```

**ja.json** 需同步添加对应的日语翻译。

---

## 实现注意事项

### 1. 组件复用

建议抽取共用组件：
- `ModeSwitchTabs` - 模式切换 Tabs 组件
- `UnifiedHeader` - 统一 Header 容器组件
- `UnifiedSearchRow` - 统一搜索行组件

### 2. 按钮样式统一

- 使用 shadcn/ui `Button` 组件
- variant 统一为 `outline` 或 `ghost`
- 图标使用 lucide-react 保持一致

### 3. 暗黑模式兼容

- 使用 Tailwind CSS 的 `dark:` 前缀
- 颜色使用 CSS 变量确保主题切换正常

### 4. 检查更新后的列表标记

- 检查更新后，在列表中标记可更新的项目
- 使用 badge 或图标指示有更新可用

---

## 验收标准

- [ ] Skills 模块 Header 和搜索行符合规范
- [ ] Commands 模块 Header 和搜索行符合规范
- [ ] Hooks 模块 Header 和搜索行符合规范
- [ ] Agents 模块 Header 和搜索行符合规范
- [ ] 所有国际化问题已修复
- [ ] 暗黑模式下显示正常
- [ ] 窄屏幕下自动换行正常
- [ ] 按钮禁用状态正确显示
