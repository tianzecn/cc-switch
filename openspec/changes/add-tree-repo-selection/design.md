# Design: Tree Repository Selection

## Context

CC Switch 应用中 Skills、Commands、Hooks、Agents 四个模块均使用相似的树状导航 + 列表的双栏布局。当前实现中，树形导航的仓库节点仅支持展开/折叠操作，用户无法通过点击仓库来查看该仓库下的所有项目。

**利益相关者**：
- 终端用户：需要更直观的导航体验
- 开发者：需要可复用的组件设计

**约束**：
- 不改变现有数据结构
- 不影响后端 API
- 保持与现有 UI 风格一致

## Goals / Non-Goals

### Goals
- 仓库节点可选中，点击时显示该仓库所有项目
- 统一四个模块的树形导航交互行为
- 提供分组显示和批量操作能力
- 优化大列表性能（无限滚动）

### Non-Goals
- 不修改后端数据模型
- 不添加 URL 状态同步
- 不支持多选过滤
- 本次不实现拖拽排序

## Decisions

### 1. 选中状态数据结构

```typescript
type SelectionType = "all" | "repo" | "namespace";

interface TreeSelection {
  type: SelectionType;
  repoId?: string;      // 仓库 ID (如 "owner/repo" 或 "local")
  namespaceId?: string; // 命名空间 ID (如 "owner/repo/namespace")
}
```

**理由**：使用联合类型明确区分三种选中状态，便于类型检查和逻辑处理。

### 2. 点击仓库行为 = 展开 + 选中

**选择**：点击仓库时同时展开子节点并选中仓库

**备选方案**：
- ❌ 分离操作（箭头展开，名称选中）：增加操作步骤
- ❌ 仅展开不选中：当前行为，用户需额外点击命名空间

**理由**：减少操作步骤，符合用户直觉。点击已展开的仓库时不折叠，保持子节点可见。

### 3. 列表分组方案 = Sticky Header

**选择**：使用 CSS `position: sticky` 实现粘性标题

**备选方案**：
- ❌ 虚拟化分组（react-window）：当前数据量不需要
- ❌ 可折叠分组（手风琴）：增加点击步骤

**理由**：
- 简单实现，无需引入新依赖
- 滚动时保持上下文可见
- 性能可接受（配合无限滚动分页）

### 4. 搜索行为 = 全局搜索

**选择**：输入搜索关键词时自动切换到"全部"视图

**备选方案**：
- ❌ 当前范围内搜索：可能搜索不到结果，用户困惑
- ❌ 提供切换开关：增加界面复杂度

**理由**：全局搜索更符合用户预期，避免"找不到"的困惑。

### 5. 分页方案 = 无限滚动

**选择**：滚动到底部时自动加载更多，每次 50 项

**备选方案**：
- ❌ 传统分页：页面跳转打断浏览流程
- ❌ 前端分页：一次加载全部数据可能卡顿

**理由**：
- 流畅的用户体验
- 前端分页，无需后端改动
- 配合 "加载更多" 按钮作为备选操作

### 6. 批量安装逻辑

**选择**：自动跳过已安装的技能，显示详细进度

```typescript
interface BatchInstallState {
  isInstalling: boolean;
  total: number;
  current: number;
  currentSkillName: string;
  failed: string[];
}
```

**理由**：
- 跳过已安装是安全的默认行为
- 详细进度让用户了解安装状态
- 记录失败项便于后续处理

## Risks / Trade-offs

### 风险 1：Sticky Header 性能
- **风险**：大量分组时 Sticky Header 可能影响滚动性能
- **缓解**：结合无限滚动分页，每次只渲染 50 项

### 风险 2：批量安装失败
- **风险**：部分技能安装失败时的状态处理
- **缓解**：记录失败项并在完成后显示汇总，不中断整体流程

### 风险 3：跨模块一致性维护
- **风险**：四个模块代码重复，后续维护困难
- **缓解**：Phase 2 抽取通用组件（NamespaceTree<T>、GroupedList<T>）

## Component Structure

```
SkillsPageNew
├── SkillNamespaceTree (左侧树)
│   ├── AllSkillsItem (全部技能节点)
│   └── RepoTreeItem[] (仓库节点)
│       └── NamespaceItem[] (命名空间节点)
└── GroupedSkillsList (右侧列表)
    ├── RepoStickyHeader (仓库粘性标题)
    ├── NamespaceSubHeader (命名空间次级标题)
    └── SkillListItem[] (技能列表项)
```

## Migration Plan

无需数据迁移，纯前端改动。

**回滚方案**：通过 Git revert 回滚相关提交即可。

## Open Questions

1. ~~批量安装时是否需要确认对话框？~~ 已决定：直接安装，跳过已安装项
2. ~~搜索时是否保留当前选中？~~ 已决定：自动切换到全局视图
3. Phase 2 通用组件的具体抽象方式（待后续提案细化）
