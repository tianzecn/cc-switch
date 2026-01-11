# tree-navigation Specification Delta

## ADDED Requirements

### Requirement: Accordion Navigation Mode

系统 SHALL 在 Skills、Commands、Hooks、Agents 页面的左侧导航树中实现手风琴模式，确保同一时间只有一个仓库处于展开状态。

#### Scenario: Expand repository collapses others
- **WHEN** 用户点击一个未展开的仓库节点
- **AND** 存在其他已展开的仓库
- **THEN** 被点击的仓库展开
- **AND** 其他所有已展开的仓库自动折叠

#### Scenario: Click expanded repository to collapse
- **WHEN** 用户点击一个已展开的仓库节点
- **THEN** 该仓库折叠
- **AND** 选中状态清空

#### Scenario: Auto-select on expand
- **WHEN** 用户点击仓库节点展开
- **THEN** 该仓库自动被选中
- **AND** 右侧内容区显示该仓库下的所有项目

#### Scenario: Namespace selection clears repository selection
- **WHEN** 用户选中仓库后点击该仓库下的某个命名空间
- **THEN** 命名空间被选中
- **AND** 仓库节点不再保持选中状态
- **AND** 仓库保持展开状态

### Requirement: Tree Navigation State Hook

系统 SHALL 提供统一的 `useTreeNavigation` hook 用于管理树形导航的展开和选中状态。

#### Scenario: Hook provides accordion state
- **WHEN** 组件使用 `useTreeNavigation` hook
- **THEN** hook 返回 `expandedRepoId`（当前展开的仓库 ID，或 null）
- **AND** 返回 `selectedItemId`（当前选中的项目 ID，或 null）
- **AND** 返回 `toggleRepo` 方法用于切换仓库展开状态

#### Scenario: Toggle repo state transitions
- **WHEN** 调用 `toggleRepo(repoId)` 且 repoId 与当前展开的仓库不同
- **THEN** `expandedRepoId` 更新为 repoId
- **AND** `selectedItemId` 更新为 repoId
- **WHEN** 调用 `toggleRepo(repoId)` 且 repoId 与当前展开的仓库相同
- **THEN** `expandedRepoId` 更新为 null
- **AND** `selectedItemId` 更新为 null
