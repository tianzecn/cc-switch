# module-header-layout Spec Delta

## Purpose

定义 Skills、Commands、Hooks、Agents 四个模块的统一 Header 按钮区布局规范。

## ADDED Requirements

### Requirement: Unified Header Layout Structure

四个模块的 Header 区域 SHALL 采用统一的左右分布布局。

#### Scenario: Header renders with unified structure
- **GIVEN** 用户打开 Skills/Commands/Hooks/Agents 任一模块
- **WHEN** 页面渲染完成
- **THEN** Header 显示为：左侧标题区 + 右侧按钮区
- **AND** 左侧包含图标和标题文字
- **AND** 右侧包含模式切换和操作按钮

### Requirement: Mode Switch Tabs Component

模式切换 SHALL 使用 Tabs 样式组件显示「已安装 | 发现」两个选项。

#### Scenario: Tabs display current mode
- **GIVEN** 用户在已安装模式
- **WHEN** 查看 Header 右侧
- **THEN** 「已安装」标签页处于选中状态（下划线高亮）
- **AND** 「发现」标签页处于未选中状态

#### Scenario: Tabs switch to discovery mode
- **GIVEN** 用户在已安装模式
- **WHEN** 用户点击「发现」标签页
- **THEN** 视图切换到发现模式
- **AND** 「发现」标签页变为选中状态

#### Scenario: Tabs switch back to installed mode
- **GIVEN** 用户在发现模式
- **WHEN** 用户点击「已安装」标签页
- **THEN** 视图切换回已安装列表
- **AND** 「已安装」标签页变为选中状态

### Requirement: Installed Mode Button Order

已安装模式的按钮 SHALL 按照固定顺序从左到右排列。

#### Scenario: Installed mode buttons order
- **GIVEN** 用户在已安装模式
- **WHEN** 查看 Header 右侧按钮区
- **THEN** 按钮顺序为：模式切换 Tabs → 仓库管理 → 检查更新 → 批量卸载

### Requirement: Discovery Mode Button Order

发现模式的按钮 SHALL 按照固定顺序排列，且无检查更新和批量卸载。

#### Scenario: Discovery mode buttons order
- **GIVEN** 用户在发现模式
- **WHEN** 查看 Header 右侧按钮区
- **THEN** 按钮顺序为：模式切换 Tabs → 仓库管理 → 刷新
- **AND** 不显示检查更新按钮
- **AND** 不显示批量卸载按钮

### Requirement: Repository Management Button Availability

仓库管理按钮 SHALL 在四个模块的已安装和发现模式中都可用。

#### Scenario: Repo manager in installed mode
- **GIVEN** 用户在 Skills/Commands/Hooks/Agents 的已安装模式
- **WHEN** 查看 Header
- **THEN** 显示仓库管理按钮

#### Scenario: Repo manager in discovery mode
- **GIVEN** 用户在 Skills/Commands/Hooks/Agents 的发现模式
- **WHEN** 查看 Header
- **THEN** 显示仓库管理按钮

### Requirement: Button Disabled States

批量卸载和检查更新按钮 SHALL 在无已安装项时显示禁用状态。

#### Scenario: Batch uninstall disabled when empty
- **GIVEN** 用户在已安装模式
- **AND** 当前筛选结果为空（无已安装项）
- **WHEN** 查看批量卸载按钮
- **THEN** 按钮显示为禁用状态（灰色不可点击）

#### Scenario: Check updates disabled when empty
- **GIVEN** 用户在已安装模式
- **AND** 当前筛选结果为空（无已安装项）
- **WHEN** 查看检查更新按钮
- **THEN** 按钮显示为禁用状态

## REMOVED Requirements

### Requirement: Installed Mode Refresh Button (REMOVED)

已安装模式 SHALL NOT 显示刷新按钮。

#### Scenario: No refresh button in installed mode
- **GIVEN** 用户在已安装模式
- **WHEN** 查看 Header
- **THEN** 不显示刷新按钮

### Requirement: Discovery Mode Check Updates Button (REMOVED)

发现模式 SHALL NOT 显示检查更新按钮。

#### Scenario: No check updates in discovery mode
- **GIVEN** 用户在发现模式
- **WHEN** 查看 Header
- **THEN** 不显示检查更新按钮

### Requirement: Discovery Mode Back Button (REMOVED)

发现模式 SHALL NOT 显示独立的返回按钮，改用 Tabs 切换。

#### Scenario: No back button in discovery mode
- **GIVEN** 用户在发现模式
- **WHEN** 查看 Header
- **THEN** 不显示返回按钮
- **AND** 用户通过 Tabs 切换回已安装模式
