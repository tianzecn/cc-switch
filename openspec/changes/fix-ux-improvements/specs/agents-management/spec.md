# agents-management Specification Delta

## ADDED Requirements

### Requirement: Agents Discovery Default Display All

系统 SHALL 在 Agents 发现模式下默认显示所有可用 Agents，无需先选择仓库或命名空间。

#### Scenario: Discovery mode shows all agents by default
- **WHEN** 用户进入 Agents 发现模式
- **AND** 未选择任何仓库或命名空间
- **THEN** 右侧列表显示所有可用 Agents
- **AND** 按仓库分组排序

#### Scenario: Global search without repository selection
- **WHEN** 用户在发现模式输入搜索关键词
- **AND** 未选择任何仓库或命名空间
- **THEN** 搜索范围覆盖所有仓库的 Agents
- **AND** 搜索匹配名称和描述字段

### Requirement: Agents Virtual Scroll

系统 SHALL 对 Agents 列表实现虚拟滚动，优化大数据量场景的性能。

#### Scenario: Virtual scroll for long list
- **WHEN** Agents 列表数据量超过 50 条
- **THEN** 使用虚拟滚动渲染可见区域
- **AND** 滚动时动态加载更多数据

#### Scenario: Batch loading
- **WHEN** 用户滚动到列表底部附近（距底部 20%）
- **THEN** 自动加载下一批 50 条数据
- **AND** 显示加载中状态

#### Scenario: Skeleton loading state
- **WHEN** 列表数据加载中
- **THEN** 显示列表项形状的骨架屏
- **AND** 骨架屏模拟真实列表项结构（左侧图标 + 右侧文字行）

### Requirement: Agents Installed Detail Panel

系统 SHALL 在 Agents 已安装列表提供右侧详情面板，显示选中 Agent 的完整配置信息。

#### Scenario: Detail panel displays on selection
- **WHEN** 用户在已安装列表选中一个 Agent
- **THEN** 右侧显示详情面板
- **AND** 面板包含完整的 Agent 信息

#### Scenario: Detail panel shows basic info
- **WHEN** Agent 详情面板渲染
- **THEN** 显示以下基本信息：
  - Agent 名称
  - 描述
  - 来源仓库名称
  - 安装时间（绝对时间格式：YYYY-MM-DD HH:mm）
  - 更新次数和最后更新时间（如有更新历史）

#### Scenario: Detail panel shows full configuration
- **WHEN** Agent 详情面板渲染
- **THEN** 显示完整配置预览区域
- **AND** 配置以 YAML 格式展示
- **AND** 包含 tools、model、allowedMCPServers 等所有字段

#### Scenario: View documentation action
- **WHEN** 用户点击「查看文档」按钮
- **THEN** 系统在默认浏览器中打开该 Agent 文件的 GitHub 页面

#### Scenario: Uninstall action
- **WHEN** 用户点击「卸载」按钮
- **THEN** 显示确认对话框
- **AND** 用户确认后卸载该 Agent

#### Scenario: Close detail panel
- **WHEN** 用户点击详情面板的关闭按钮或选中其他 Agent
- **THEN** 详情面板关闭或更新显示新选中的 Agent
