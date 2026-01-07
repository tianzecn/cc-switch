# 树结构仓库级选中功能规格说明

## 概述

本规格说明定义了 Skills、Commands、Hooks、Agents 四个模块的树状导航组件增强功能，使仓库节点可被点击选中并在右侧列表显示对应数据。

## 背景与问题

### 当前状态
- 左侧树结构为两级：仓库 → 命名空间
- 点击仓库节点仅展开/折叠子节点
- 只有点击命名空间节点时才会在右侧显示对应列表
- 用户期望点击仓库时也能看到该仓库下的所有项目

### 目标
- 点击仓库节点时，同时展开并在右侧显示该仓库下所有项目
- 保持统一的交互模式和视觉设计语言
- 四个模块（Skills、Commands、Hooks、Agents）采用相同的设计方案

---

## 详细设计

### 1. 交互行为规范

#### 1.1 仓库节点点击行为
| 操作 | 行为 |
|------|------|
| 点击未展开的仓库 | 展开仓库 + 选中仓库 + 右侧显示该仓库所有项目 |
| 点击已展开的仓库 | **不折叠** + 切换选中状态 + 右侧显示该仓库所有项目 |
| 点击命名空间 | 选中该命名空间 + 右侧显示该命名空间项目 |

#### 1.2 选中状态管理
- **单选模式**：同一时刻只能选中一个节点（仓库或命名空间）
- **独占选中**：选中命名空间后，仓库不保持选中状态
- **选中命名空间后，父级仓库无需保持次级选中样式**

#### 1.3 本地节点处理
- "本地技能 (Local Skills)" 等本地节点与远程仓库节点行为完全一致
- 点击本地节点同样展开并显示所有本地项目

### 2. 视觉设计规范

#### 2.1 选中状态样式

| 元素 | 未选中 | 选中 |
|------|--------|------|
| **仓库节点** | `hover:bg-muted` | `bg-primary/15 border-l-2 border-primary` |
| **命名空间节点** | `hover:bg-muted` | `bg-primary/10 text-primary` |

> 仓库使用更深的背景色 + 左侧边框，与命名空间形成层级差异化

#### 2.2 图标状态
- 仓库选中时：图标保持原色（GitBranch: blue-500, HardDrive: green-500）
- 命名空间选中时：图标变为 `text-primary`

### 3. 右侧列表显示规范

#### 3.1 按命名空间分组显示

当选中仓库时，右侧列表按命名空间分组显示：

```
┌─────────────────────────────────────────┐
│ [仓库名] - X 个技能                       │ ← 仓库标题（可选）
├─────────────────────────────────────────┤
│ ▼ namespace-a                    (3)    │ ← Sticky Header
│   ├─ Skill 1                            │
│   ├─ Skill 2                            │
│   └─ Skill 3                            │
├─────────────────────────────────────────┤
│ ▼ namespace-b                    (2)    │ ← Sticky Header
│   ├─ Skill 4                            │
│   └─ Skill 5                            │
└─────────────────────────────────────────┘
```

#### 3.2 "全部" 视图层级分组

当选中 "All Skills" 时，按完整层级分组：

```
┌─────────────────────────────────────────┐
│ ▼ owner/repo-1                   (5)    │ ← 仓库 Sticky Header
│   ├─ ▼ namespace-a              (3)     │ ← 命名空间次级标题
│   │   ├─ Skill 1                        │
│   │   └─ Skill 2                        │
│   └─ ▼ namespace-b              (2)     │
│       └─ Skill 3                        │
├─────────────────────────────────────────┤
│ ▼ owner/repo-2                   (3)    │ ← 仓库 Sticky Header
│   └─ ▼ skills                   (3)     │
│       ├─ Skill 4                        │
│       └─ Skill 5                        │
└─────────────────────────────────────────┘
```

#### 3.3 Sticky Header 实现
- 使用 CSS `position: sticky` 实现粘性标题
- 仓库标题 `z-index: 20`，命名空间标题 `z-index: 10`
- 滚动时标题固定在对应层级位置

### 4. 搜索功能增强

#### 4.1 全局搜索行为
- 当用户输入搜索关键词时，**自动切换到 "全部" 视图**
- 搜索结果显示完整层级分组
- 清空搜索框后保持 "全部" 视图选中状态

#### 4.2 实现方式
```typescript
// 搜索输入变化时
const handleSearchChange = (query: string) => {
  setSearchQuery(query);
  if (query.trim()) {
    setSelectedNode(null); // 切换到全部视图
  }
};
```

### 5. 发现模式增强（仅 Skills）

#### 5.1 批量安装功能

当选中仓库时，列表头部显示批量安装按钮：

```
┌─────────────────────────────────────────┐
│ owner/repo · 10 个技能 · 3 个未安装       │
│                    [安装全部未安装的 (3)] │
├─────────────────────────────────────────┤
│ ... 技能列表 ...                         │
└─────────────────────────────────────────┘
```

#### 5.2 批量安装逻辑
- 自动跳过已安装的技能
- 顺序安装未安装的技能
- 显示详细安装进度："正在安装 3/10..."

#### 5.3 进度显示
```typescript
interface BatchInstallState {
  isInstalling: boolean;
  total: number;
  current: number;
  currentSkillName: string;
  failed: string[];
}
```

显示格式：`正在安装 ${current}/${total}: ${currentSkillName}`

### 6. 性能优化

#### 6.1 无限滚动加载
- 默认每次加载 50 项
- 滚动到底部时自动加载更多
- 同时提供 "加载更多" 按钮
- 显示加载状态和剩余数量

#### 6.2 实现考虑
```typescript
const PAGE_SIZE = 50;

interface PaginationState {
  page: number;
  hasMore: boolean;
  isLoading: boolean;
}
```

### 7. 空状态处理

#### 7.1 引导性空状态提示

| 场景 | 提示内容 |
|------|----------|
| 仓库无技能（发现模式） | "该仓库暂无可用技能" |
| 仓库无已安装技能 | "该仓库下没有已安装的技能" |
| 命名空间为空 | "该命名空间下没有技能" |
| 搜索无结果 | "没有找到匹配的技能，试试其他关键词？" |

#### 7.2 空状态组件
```tsx
<EmptyState
  icon={<Compass />}
  title={t("skills.empty.repo")}
  description={t("skills.empty.repoDescription")}
/>
```

### 8. 状态管理

#### 8.1 选中状态类型定义

```typescript
type SelectionType = "all" | "repo" | "namespace";

interface TreeSelection {
  type: SelectionType;
  repoId?: string;      // 仓库 ID (如 "owner/repo" 或 "local")
  namespaceId?: string; // 命名空间 ID (如 "owner/repo/namespace")
}
```

#### 8.2 URL 状态同步
- **不需要** URL 状态同步
- 刷新页面时重置为默认 "全部" 视图

### 9. 一致性要求

#### 9.1 跨模式一致性
| 特性 | 已安装列表 | 发现模式 |
|------|-----------|----------|
| 树结构 | ✓ 一致 | ✓ 一致 |
| 选中交互 | ✓ 一致 | ✓ 一致 |
| 分组显示 | ✓ 一致 | ✓ 一致 |
| 批量操作 | ✗ 不需要 | ✓ 批量安装 |

#### 9.2 跨模块一致性
| 模块 | 树结构 | 交互行为 | 分组显示 |
|------|--------|----------|----------|
| Skills | ✓ | ✓ | ✓ |
| Commands | ✓ | ✓ | ✓ |
| Hooks | ✓ | ✓ | ✓ |
| Agents | ✓ | ✓ | ✓ |

#### 9.3 单一子节点处理
- 即使仓库下只有一个命名空间（如 root），仍保持两层结构
- 不进行智能折叠

---

## 实现计划

### 阶段 1：Skills 模块（优先）

1. **SkillNamespaceTree 组件重构**
   - 添加仓库选中支持
   - 调整选中状态样式
   - 修改点击行为

2. **SkillDiscoveryTree 组件重构**
   - 同步 SkillNamespaceTree 的改动
   - 添加批量安装入口

3. **SkillsPageNew 列表区域增强**
   - 实现分组显示
   - 添加 Sticky Header
   - 实现无限滚动

4. **批量安装功能**
   - 实现批量安装逻辑
   - 添加进度显示

### 阶段 2：复用到其他模块

5. **抽取通用组件**
   - `NamespaceTree<T>` 通用树组件
   - `GroupedList<T>` 分组列表组件
   - `usePagination` 分页 Hook

6. **应用到 Commands、Hooks、Agents**
   - 替换现有树组件
   - 适配各模块数据结构

---

## 技术考虑

### 数据结构
```typescript
// 统一的选中状态
interface TreeSelection {
  type: "all" | "repo" | "namespace";
  repoId?: string;
  namespaceId?: string;
}

// 分组后的列表数据
interface GroupedItems<T> {
  repoId: string;
  repoName: string;
  namespaces: Array<{
    namespaceId: string;
    namespaceName: string;
    items: T[];
  }>;
}
```

### 组件结构
```
SkillsPageNew
├── SkillNamespaceTree (左侧树)
│   ├── AllSkillsItem
│   └── RepoTreeItem[]
│       └── NamespaceItem[]
└── GroupedSkillsList (右侧列表)
    ├── RepoStickyHeader
    ├── NamespaceSubHeader
    └── SkillListItem[]
```

---

## 验收标准

- [ ] 点击仓库节点可选中并显示该仓库所有项目
- [ ] 仓库和命名空间选中状态有明显视觉区分
- [ ] 选中命名空间后仓库不保持选中状态
- [ ] 右侧列表正确按命名空间分组显示
- [ ] 全部视图按完整层级分组显示
- [ ] Sticky Header 正常工作
- [ ] 搜索时自动切换到全部视图
- [ ] 发现模式支持批量安装
- [ ] 批量安装显示详细进度
- [ ] 无限滚动加载正常工作
- [ ] 空状态显示引导性提示
- [ ] 四个模块交互一致

---

## 附录

### A. 涉及文件列表

**Skills 模块：**
- `src/components/skills/SkillNamespaceTree.tsx`
- `src/components/skills/SkillDiscoveryTree.tsx`
- `src/components/skills/SkillsPageNew.tsx`
- `src/components/skills/SkillsList.tsx`

**Commands 模块：**
- `src/components/commands/NamespaceTree.tsx`
- `src/components/commands/CommandDiscoveryTree.tsx`
- `src/components/commands/CommandsPage.tsx`

**Hooks 模块：**
- `src/components/hooks/HookNamespaceTree.tsx`
- `src/components/hooks/HookDiscoveryTree.tsx`
- `src/components/hooks/HooksPage.tsx`

**Agents 模块：**
- `src/components/agents/AgentNamespaceTree.tsx`
- `src/components/agents/AgentDiscoveryTree.tsx`
- `src/components/agents/AgentsPage.tsx`

### B. 设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 点击仓库行为 | 展开+选中同时发生 | 减少操作步骤，提升效率 |
| 选中样式 | 层级差异化 | 清晰区分仓库和命名空间层级 |
| 分组样式 | Sticky Header | 滚动时保持上下文可见 |
| 搜索范围 | 全局搜索 | 避免用户在局部范围搜索不到结果的困惑 |
| URL 同步 | 不需要 | 简化实现，减少复杂度 |
| 批量安装 | 跳过已安装 | 安全默认行为，避免重复操作 |
| 分页方式 | 无限滚动 | 更流畅的用户体验 |

---

*规格版本：1.0*
*创建日期：2026-01-07*
*最后更新：2026-01-07*
