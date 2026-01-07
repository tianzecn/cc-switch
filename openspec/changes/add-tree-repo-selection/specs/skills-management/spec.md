## ADDED Requirements

### Requirement: Repository Node Selection

系统 SHALL 支持仓库节点的选中功能，使用户能够查看该仓库下的所有项目。

#### Scenario: Click repository to select and expand
- **WHEN** 用户点击未展开的仓库节点
- **THEN** 仓库节点展开显示子命名空间
- **AND** 仓库节点被选中
- **AND** 右侧列表显示该仓库下的所有技能

#### Scenario: Click expanded repository to select
- **WHEN** 用户点击已展开的仓库节点
- **THEN** 仓库节点保持展开状态（不折叠）
- **AND** 仓库节点被选中
- **AND** 右侧列表显示该仓库下的所有技能

#### Scenario: Namespace exclusive selection
- **WHEN** 用户选中仓库后再点击该仓库下的某个命名空间
- **THEN** 命名空间被选中
- **AND** 仓库节点不再保持选中状态

#### Scenario: Repository selection style
- **WHEN** 仓库节点被选中
- **THEN** 仓库节点使用层级差异化样式（更深背景色 + 左侧边框）
- **AND** 与命名空间选中样式有明显视觉区分

### Requirement: Grouped List Display

系统 SHALL 在右侧列表中按层级分组显示项目，使用 Sticky Header 保持上下文可见。

#### Scenario: Repository view shows namespace groups
- **WHEN** 用户选中仓库节点
- **THEN** 右侧列表按命名空间分组显示该仓库的所有技能
- **AND** 每个命名空间有独立的分组标题

#### Scenario: All skills view shows full hierarchy
- **WHEN** 用户选择"全部技能"节点
- **THEN** 右侧列表按完整层级（仓库→命名空间）分组显示
- **AND** 仓库标题和命名空间标题均显示

#### Scenario: Sticky header behavior
- **WHEN** 用户滚动列表
- **THEN** 当前可见区域的分组标题粘性固定在顶部
- **AND** 仓库标题 z-index 高于命名空间标题

### Requirement: Global Search Behavior

系统 SHALL 在搜索时自动切换到全局视图，确保搜索结果完整。

#### Scenario: Search triggers global view
- **WHEN** 用户在搜索框输入关键词
- **THEN** 自动切换到"全部技能"视图
- **AND** 搜索结果显示完整层级分组

#### Scenario: Clear search maintains global view
- **WHEN** 用户清空搜索框
- **THEN** 保持"全部技能"视图选中状态
- **AND** 显示所有技能的完整层级分组

### Requirement: Batch Install in Discovery Mode

系统 SHALL 在发现模式下支持批量安装功能，提升安装效率。

#### Scenario: Batch install button display
- **WHEN** 用户在发现模式下选中仓库节点
- **AND** 该仓库有未安装的技能
- **THEN** 列表头部显示"安装全部未安装的"按钮
- **AND** 按钮显示未安装的技能数量

#### Scenario: Batch install skips installed
- **WHEN** 用户点击批量安装按钮
- **THEN** 系统自动跳过已安装的技能
- **AND** 仅安装未安装的技能

#### Scenario: Batch install progress display
- **WHEN** 批量安装进行中
- **THEN** 显示详细安装进度（如"正在安装 3/10: skill-name"）
- **AND** 按钮变为禁用状态

#### Scenario: Batch install completion
- **WHEN** 批量安装完成
- **THEN** 显示安装汇总（成功数、失败数）
- **AND** 刷新列表显示最新安装状态

### Requirement: Infinite Scroll Pagination

系统 SHALL 对长列表实现无限滚动加载，优化性能体验。

#### Scenario: Initial load limit
- **WHEN** 列表首次加载
- **THEN** 显示前 50 项
- **AND** 如有更多项显示加载提示

#### Scenario: Scroll to load more
- **WHEN** 用户滚动到列表底部
- **THEN** 自动加载下一批 50 项
- **AND** 显示加载中状态

#### Scenario: Load more button
- **WHEN** 列表有更多项未加载
- **THEN** 底部显示"加载更多"按钮作为备选操作
- **AND** 显示剩余项数量

### Requirement: Contextual Empty State

系统 SHALL 根据不同场景显示引导性空状态提示。

#### Scenario: Empty repository in discovery mode
- **WHEN** 用户在发现模式下选中的仓库没有可用技能
- **THEN** 显示空状态提示"该仓库暂无可用技能"

#### Scenario: Empty repository in installed list
- **WHEN** 用户选中的仓库没有已安装的技能
- **THEN** 显示空状态提示"该仓库下没有已安装的技能"

#### Scenario: Empty search results
- **WHEN** 搜索结果为空
- **THEN** 显示空状态提示"没有找到匹配的技能，试试其他关键词？"

#### Scenario: Empty namespace
- **WHEN** 用户选中的命名空间没有技能
- **THEN** 显示对应的空状态提示

## MODIFIED Requirements

### Requirement: Skill Namespace Support

系统 SHALL 支持 Skills 的命名空间管理，实现三级结构（仓库 → 命名空间 → Skill），并支持仓库级别的选中和过滤。

#### Scenario: Namespace tree displays repository structure
- **WHEN** Skills 页面加载
- **THEN** 左侧树形导航显示：
  - "全部 Skills" 顶级节点
  - 本地 Skills 分组（绿色图标）
  - 远程仓库分组（蓝色图标）
  - 每个仓库下显示命名空间节点

#### Scenario: Namespace filtering
- **WHEN** 用户选择特定命名空间节点
- **THEN** 右侧列表仅显示该命名空间下的 Skills

#### Scenario: All skills view
- **WHEN** 用户选择"全部 Skills"节点
- **THEN** 右侧列表显示所有已安装的 Skills
- **AND** 按仓库→命名空间层级分组显示

#### Scenario: Repository filtering
- **WHEN** 用户选择仓库节点
- **THEN** 右侧列表显示该仓库下所有命名空间的 Skills
- **AND** 按命名空间分组显示

#### Scenario: Local skills node behavior
- **WHEN** 用户点击"本地技能"节点
- **THEN** 行为与远程仓库节点一致
- **AND** 展开并选中，显示所有本地技能

### Requirement: Skills Header Actions

系统 SHALL 在页面头部提供搜索和操作按钮，搜索时自动切换到全局视图。

#### Scenario: Search functionality
- **WHEN** 用户在搜索框输入文本
- **THEN** 自动切换到"全部技能"视图
- **AND** Skills 列表按名称、描述、目录进行过滤

#### Scenario: Filter by status
- **WHEN** 用户选择筛选器（已安装/未安装/全部）
- **THEN** 列表按安装状态过滤（仅在发现模式下有效）

#### Scenario: Refresh action
- **WHEN** 用户点击刷新按钮
- **THEN** 重新加载 Skills 数据

#### Scenario: Import action
- **WHEN** 用户点击导入按钮
- **THEN** 进入导入模式，扫描未管理的 Skills

#### Scenario: Discover action
- **WHEN** 用户点击发现按钮
- **THEN** 进入发现模式，显示可安装的远程 Skills
