# Tasks: Add Tree Repository Selection

## Phase 1: Skills 模块实现

### 1. 树组件选中状态支持

- [x] 1.1 定义 `TreeSelection` 类型（type: all/repo/namespace, repoId, namespaceId）
  - 已创建 `src/types/tree.ts`
- [x] 1.2 重构 `SkillNamespaceTree` 添加仓库选中支持
  - 添加 `selection` / `onSelectionChange` props
  - 修改点击行为：展开 + 选中同时触发
  - 点击已展开仓库时不折叠
- [x] 1.3 实现仓库选中差异化样式（bg-primary/15 + border-l-2）
- [x] 1.4 同步改动到 `SkillDiscoveryTree` 组件

### 2. 分组列表显示

- [x] 2.1 创建 `GroupedSkillsList` 组件
  - 支持按命名空间分组
  - 支持按仓库→命名空间完整层级分组
- [x] 2.2 实现 `StickyHeader` 分组标题组件
  - 仓库标题样式（z-index: 20）
  - 命名空间标题样式（z-index: 10）
- [x] 2.3 集成到 `SkillsPageNew` 页面
  - 选中仓库时显示命名空间分组
  - 选中"全部"时显示完整层级分组

### 3. 搜索行为增强

- [x] 3.1 修改搜索处理逻辑
  - 输入搜索词时自动切换到"全部"视图
  - 清空搜索框时保持"全部"视图

### 4. 批量安装功能（发现模式）

- [x] 4.1 添加 `useBatchInstall` Hook
  - 管理安装状态（total, current, currentName, failed）
  - 顺序安装，跳过已安装项
  - 已创建 `src/hooks/useBatchInstall.ts`
- [x] 4.2 创建批量安装按钮组件
  - 显示在仓库选中时的列表头部
  - 显示未安装数量
  - 已创建 `src/components/skills/BatchInstallButton.tsx`
- [x] 4.3 实现安装进度显示
  - 进度文本（"正在安装 3/10: skill-name"）
  - 完成后显示汇总 toast

### 5. 无限滚动分页

- [x] 5.1 分页逻辑内置于 `GroupedSkillsList`
  - IntersectionObserver 自动加载
  - 默认 50 项每页
- [x] 5.2 实现滚动加载触发
  - IntersectionObserver 检测底部
  - 加载中状态显示
- [x] 5.3 添加"加载更多"按钮
  - 显示剩余数量
  - 作为备选操作

### 6. 空状态处理

- [x] 6.1 `EmptyState` 组件内置于 `GroupedSkillsList`
- [x] 6.2 实现场景化空状态提示
  - 仓库无技能（发现模式）
  - 仓库无已安装技能
  - 命名空间为空
  - 搜索无结果

### 7. 测试与验收

- [ ] 7.1 编写树组件单元测试
  - 仓库选中状态切换
  - 命名空间独占选中
- [ ] 7.2 编写分组列表测试
  - 分组数据正确
  - Sticky Header 渲染
- [ ] 7.3 编写批量安装测试
  - 跳过已安装逻辑
  - 进度状态管理
- [ ] 7.4 手动验收测试
  - 所有场景符合规格说明

---

## Phase 2: 跨模块复用（后续独立提案）

> 以下任务将在 Phase 1 完成后，通过独立提案实现

- [ ] 抽取 `NamespaceTree<T>` 通用组件
- [ ] 抽取 `GroupedList<T>` 通用组件
- [ ] 应用到 Commands 模块
- [ ] 应用到 Hooks 模块
- [ ] 应用到 Agents 模块

---

## Dependencies

- 无外部依赖
- 无后端改动

## Parallelizable Work

- 任务 1（树组件）和任务 5（分页）可并行
- 任务 4（批量安装）和任务 6（空状态）可并行

## Validation

每个任务完成后运行：
```bash
pnpm typecheck
pnpm test:unit
```

全部完成后运行：
```bash
pnpm build
```
