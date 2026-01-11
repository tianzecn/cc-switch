# commands-management Specification Delta

## ADDED Requirements

### Requirement: Commands Discovery Default Display All

系统 SHALL 在 Commands 发现模式下默认显示所有可用 Commands，无需先选择仓库。

#### Scenario: Discovery mode shows all commands by default
- **WHEN** 用户进入 Commands 发现模式
- **AND** 未选择任何仓库
- **THEN** 右侧列表显示所有可用 Commands
- **AND** 按仓库分组排序

#### Scenario: Global search without repository selection
- **WHEN** 用户在发现模式输入搜索关键词
- **AND** 未选择任何仓库
- **THEN** 搜索范围覆盖所有仓库的 Commands
- **AND** 搜索匹配名称和描述字段

### Requirement: Commands Virtual Scroll

系统 SHALL 对 Commands 列表实现虚拟滚动，优化大数据量场景的性能。

#### Scenario: Virtual scroll for long list
- **WHEN** Commands 列表数据量超过 50 条
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

### Requirement: Commands Install Time Display

系统 SHALL 正确显示 Commands 的安装时间，使用绝对时间格式。

#### Scenario: Display correct install time
- **WHEN** 用户查看已安装 Command 的详情
- **THEN** 安装时间显示为绝对时间格式（YYYY-MM-DD HH:mm）
- **AND** 时间戳正确解析（非 1970 年）

#### Scenario: Handle missing install time
- **WHEN** Command 的安装时间为空或无效
- **THEN** 显示「未知」而非错误日期
