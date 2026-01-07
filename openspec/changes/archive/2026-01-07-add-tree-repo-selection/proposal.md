# Change: Add Tree Repository Selection

## Why

当前树结构导航中，仓库节点只能展开/折叠，无法被选中。用户期望点击仓库时能够在右侧列表显示该仓库下的所有项目，这符合常见的树形导航交互模式，能够提升用户体验和操作效率。

## What Changes

### 核心交互增强
- 仓库节点支持选中，点击时**同时展开并选中**
- 右侧列表按命名空间分组显示（使用 Sticky Header）
- "全部" 视图按完整层级（仓库→命名空间）分组显示
- 搜索输入时**自动切换到全局视图**

### 视觉样式调整
- 仓库选中状态使用层级差异化样式（更深背景色 + 左侧边框）
- 命名空间独占选中（选中命名空间后仓库不保持选中状态）

### 发现模式增强（仅 Skills）
- 选中仓库时显示**批量安装按钮**
- 批量安装自动跳过已安装的技能
- 显示详细安装进度（如 "正在安装 3/10..."）

### 性能优化
- 列表采用**无限滚动加载**（每次 50 项）
- 空状态显示引导性提示

### 跨模块一致性
- Skills、Commands、Hooks、Agents 四个模块采用**相同的设计方案**
- 已安装列表和发现模式的树结构交互**完全一致**

## Impact

- Affected specs:
  - `specs/skills-management/spec.md` - 主要变更
  - （后续 Phase 2 将创建 commands-management、hooks-management、agents-management specs）

- Affected code:
  - `src/components/skills/SkillNamespaceTree.tsx`
  - `src/components/skills/SkillDiscoveryTree.tsx`
  - `src/components/skills/SkillsPageNew.tsx`
  - `src/components/skills/SkillsList.tsx`
  - （后续 Phase 2: Commands、Hooks、Agents 相关组件）

## Scope

本提案采用分阶段实现：
- **Phase 1**: Skills 模块完整实现（作为参考实现）
- **Phase 2**: 抽取通用组件，复用到其他模块（后续独立提案）

## Reference

详细规格说明：`plans/tree-repo-selection-spec.md`
