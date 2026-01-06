# 统一导航栏重构规格说明

> **状态**: Draft
> **创建日期**: 2026-01-06
> **作者**: Claude (访谈生成)

## 1. 概述

### 1.1 背景
当前 CC Switch 应用的导航结构分散在多个组件中，首页（Providers）和各子页面（Skills、Commands、Hooks、Agents、Prompts、MCP）的头部布局不一致。本次重构旨在创建统一的顶部导航栏组件，提供一致的用户体验。

### 1.2 目标
- 创建单一的 `UnifiedNavbar` 组件，统一管理所有页面的导航栏
- 提供 3 行布局结构：核心区 + 功能按钮区 + 操作按钮区
- 完整重构现有页面，移除各页面的头部逻辑

## 2. 设计规格

### 2.1 整体结构

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

**总高度**: 约 96px（不含拖拽区）+ 28px（拖拽区）= 124px

### 2.2 第一行 - 核心区

#### 首页（Providers）布局
| 位置 | 元素 | 说明 |
|------|------|------|
| 左侧 | CC Switch 标题 | 可点击，返回首页 |
| 左侧 | 设置按钮 (齿轮图标) | 点击进入 Settings 页面 |
| 左侧 | UpdateBadge | 显示更新提示 |
| 右侧 | ProxyToggle | 代理开关 |
| 右侧 | AppSwitcher | Claude/Codex/Gemini 切换（保留现有胶囊样式）|
| 右侧 | + 按钮 | 橙色圆形按钮，新建 Provider |

#### 子页面布局
| 位置 | 元素 | 说明 |
|------|------|------|
| 左侧 | 返回按钮 | 点击返回上级页面 |
| 左侧 | 当前页面标题 | 如 "Skills 管理"、"MCP 服务器" |
| 右侧 | 设置按钮 | 始终可用，点击进入 Settings |
| 右侧 | ProxyToggle | 保留代理开关 |
| 右侧 | AppSwitcher | 保留应用切换器 |
| 右侧 | + 按钮 | 始终为新建 Provider |

### 2.3 第二行 - 功能按钮区

#### 按钮列表（保持现有顺序）
1. **Skills** - Wrench 图标
2. **Commands** - Terminal 图标
3. **Hooks** - Webhook 图标
4. **Agents** - Bot 图标
5. **Prompts** - Book 图标
6. **MCP** - Server 图标

#### 样式规格
- **默认状态**: 图标 + 简短文字标签
- **高亮状态**: 当前页面对应的按钮高亮显示
- **响应式**: 窄屏时隐藏文字，只显示图标

#### 高亮逻辑
| 当前页面 | 高亮按钮 |
|----------|----------|
| Providers (首页) | 无高亮 |
| Settings | 无高亮 |
| Skills | Skills |
| SkillsDiscovery | Skills (子页面) |
| Commands | Commands |
| Hooks | Hooks |
| Agents | Agents |
| Prompts | Prompts |
| MCP | MCP |
| Universal | 无高亮 |

### 2.4 第三行 - 操作按钮区

#### 按钮样式
- 使用 `outline` variant（替代现有的 `ghost`）
- 图标 + 文字

#### 各页面操作按钮
| 页面 | 操作按钮 |
|------|----------|
| Providers | (无) |
| Settings | (无) |
| Skills | 导入、发现 |
| SkillsDiscovery | 刷新、仓库管理 |
| Commands | (待确认) |
| Hooks | (待确认) |
| Agents | (待确认) |
| Prompts | + 新建 |
| MCP | 导入、+ 新建 |
| Universal | (无) |

#### 空行处理
- 无操作按钮时保留空行作为占位符，保持导航栏高度一致

### 2.5 返回导航逻辑

| 当前页面 | 返回目标 |
|----------|----------|
| Skills | 首页 (Providers) |
| SkillsDiscovery | Skills |
| Commands | 首页 |
| Hooks | 首页 |
| Agents | 首页 |
| Prompts | 首页 |
| MCP | 首页 |
| Settings | 首页 |
| Universal | 首页 |

### 2.6 响应式设计

#### 断点策略
- **宽屏 (≥768px)**: 功能按钮显示图标 + 文字
- **窄屏 (<768px)**: 功能按钮只显示图标

#### 最小宽度
- 建议设置应用最小宽度，确保所有元素正常显示

## 3. 技术实现

### 3.1 组件架构

```
src/components/
├── UnifiedNavbar.tsx          # 新建：统一导航栏组件
├── UnifiedNavbar/             # (可选) 子组件目录
│   ├── NavbarRow1.tsx         # 核心区
│   ├── NavbarRow2.tsx         # 功能按钮区
│   └── NavbarRow3.tsx         # 操作按钮区
```

**决策**: 采用单一 `UnifiedNavbar` 组件方案，不拆分子组件。

### 3.2 Props 接口设计

```typescript
interface UnifiedNavbarProps {
  // 当前视图状态
  currentView: View;
  onViewChange: (view: View) => void;

  // 应用切换
  activeApp: AppId;
  onAppChange: (app: AppId) => void;

  // 第三行操作按钮的 ref（用于触发页面操作）
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

### 3.3 状态管理

- 保持现有 `useState` 方案管理 `currentView`
- 不引入路由库

### 3.4 动画效果

- 保持现有 `fade` 效果用于页面切换
- 导航栏保持稳定，只有内容区域有动画

### 3.5 需要重构的页面组件

以下组件需要移除各自的头部逻辑：

1. `src/components/skills/SkillsPage.tsx`
2. `src/components/skills/UnifiedSkillsPanel.tsx`
3. `src/components/commands/CommandsPage.tsx`
4. `src/components/hooks/HooksPage.tsx`
5. `src/components/agents/AgentsPage.tsx`
6. `src/components/prompts/PromptPanel.tsx`
7. `src/components/mcp/UnifiedMcpPanel.tsx`
8. `src/components/settings/SettingsPage.tsx`
9. `src/components/universal/UniversalProviderPanel.tsx`

### 3.6 App.tsx 修改

```tsx
// 修改前
<header>
  {/* 分散的导航逻辑 */}
</header>

// 修改后
<UnifiedNavbar
  currentView={currentView}
  onViewChange={setCurrentView}
  activeApp={activeApp}
  onAppChange={setActiveApp}
  onAddProvider={() => setIsAddOpen(true)}
  pageActionRefs={{ ... }}
/>
```

## 4. i18n 文字标签

### 4.1 功能按钮标签（简短版）

| 功能 | 英文 | 中文 | 日文 |
|------|------|------|------|
| Skills | Skills | 技能 | スキル |
| Commands | Commands | 命令 | コマンド |
| Hooks | Hooks | 钩子 | フック |
| Agents | Agents | 智能体 | エージェント |
| Prompts | Prompts | 提示词 | プロンプト |
| MCP | MCP | MCP | MCP |

### 4.2 操作按钮标签

已有翻译，保持现有 i18n key 结构。

## 5. 不在范围内

以下内容不在本次重构范围内：

- [ ] 引入路由库（TanStack Router / React Router）
- [ ] Universal Providers 加入功能按钮行
- [ ] 更改 AppSwitcher 胶囊样式
- [ ] 添加键盘快捷键（已有 Cmd/Ctrl+, 打开设置）
- [ ] 右键菜单功能

## 6. 验收标准

### 6.1 功能验收
- [ ] 所有页面使用统一的导航栏组件
- [ ] 功能按钮正确高亮当前页面
- [ ] 返回按钮正确导航到上级页面
- [ ] + 按钮在所有页面都打开新建 Provider 对话框
- [ ] 设置按钮在所有页面都可用
- [ ] ProxyToggle 和 AppSwitcher 在所有页面都可用

### 6.2 响应式验收
- [ ] 窄屏时功能按钮只显示图标
- [ ] 所有元素在各种屏幕宽度下正常显示

### 6.3 样式验收
- [ ] 导航栏总高度约 96px（不含拖拽区）
- [ ] 第三行操作按钮使用 outline 样式
- [ ] 保持与现有设计语言一致

### 6.4 代码质量
- [ ] 各页面组件的头部逻辑已移除
- [ ] 无重复代码
- [ ] TypeScript 类型完整

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 导航栏高度增加占用内容空间 | 中 | 采用紧凑的 32px 每行设计 |
| 各页面操作按钮逻辑复杂 | 低 | 通过 ref 回调机制处理 |
| i18n 文字长度差异导致布局问题 | 低 | 使用简短标签 + 响应式隐藏文字 |

## 8. 附录

### 8.1 现有页面视图类型

```typescript
type View =
  | "providers"      // 首页
  | "settings"       // 设置
  | "prompts"        // 提示词管理
  | "skills"         // 技能管理
  | "skillsDiscovery"// 技能发现
  | "mcp"            // MCP 服务器管理
  | "agents"         // 智能体管理
  | "universal"      // 统一供应商
  | "commands"       // 命令管理
  | "hooks";         // 钩子管理
```

### 8.2 相关文件路径

- `src/App.tsx` - 主应用组件
- `src/components/AppSwitcher.tsx` - 应用切换器
- `src/components/proxy/ProxyToggle.tsx` - 代理开关
- `src/components/UpdateBadge.tsx` - 更新提示

---

**访谈完成时间**: 2026-01-06
**下一步**: 等待确认后开始实现
