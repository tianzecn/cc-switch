# module-searchbar-layout Spec Delta

## Purpose

定义 Skills、Commands、Hooks、Agents 四个模块的统一搜索行布局规范。

## ADDED Requirements

### Requirement: Unified Search Row Layout

搜索行 SHALL 将搜索框和统计信息合并为一行布局。

#### Scenario: Search row renders in single line
- **GIVEN** 用户打开 Skills/Commands/Hooks/Agents 任一模块
- **WHEN** 页面渲染完成
- **THEN** 搜索框和统计信息显示在同一行
- **AND** 搜索框在左侧并占据剩余空间
- **AND** 统计信息在搜索框右侧

### Requirement: Installed Mode Stats Display

已安装模式的统计信息 SHALL 显示已安装数量。

#### Scenario: Stats show installed count
- **GIVEN** 用户在已安装模式
- **AND** 有 N 个已安装项
- **WHEN** 查看搜索行
- **THEN** 显示 "已安装 N 个" 格式的统计信息

### Requirement: Discovery Mode Stats Display

发现模式的统计信息 SHALL 显示可用数量和已安装数量。

#### Scenario: Stats show available and installed count
- **GIVEN** 用户在发现模式
- **AND** 有 X 个可用项、Y 个已安装项
- **WHEN** 查看搜索行
- **THEN** 显示 "可用 X 个 · 已安装 Y 个" 格式的统计信息

### Requirement: Discovery Mode Install All Button

发现模式的搜索行 SHALL 在右侧显示 Install All 按钮。

#### Scenario: Install All button in discovery mode
- **GIVEN** 用户在发现模式
- **WHEN** 查看搜索行
- **THEN** 在统计信息右侧显示 Install All 按钮

#### Scenario: Install All disabled when all installed
- **GIVEN** 用户在发现模式
- **AND** 当前显示的所有项都已安装
- **WHEN** 查看 Install All 按钮
- **THEN** 按钮显示为禁用状态

#### Scenario: Install All enabled when uninstalled exists
- **GIVEN** 用户在发现模式
- **AND** 当前显示的项中有未安装的
- **WHEN** 查看 Install All 按钮
- **THEN** 按钮显示为可用状态

### Requirement: Search Row Responsive Layout

搜索行 SHALL 在窄屏幕下自动换行。

#### Scenario: Search row wraps on narrow screen
- **GIVEN** 视口宽度小于 800px
- **WHEN** 搜索行渲染
- **THEN** 搜索框独占一行
- **AND** 统计信息和操作按钮换到下一行

#### Scenario: Search row single line on wide screen
- **GIVEN** 视口宽度大于等于 800px
- **WHEN** 搜索行渲染
- **THEN** 所有元素显示在同一行

### Requirement: Consistent Search Box Style

四个模块的搜索框 SHALL 使用完全一致的样式。

#### Scenario: Search box style consistency
- **GIVEN** 用户切换 Skills/Commands/Hooks/Agents 各模块
- **WHEN** 查看搜索框
- **THEN** 搜索框的宽度、高度、圆角、占位符样式完全一致

## REMOVED Requirements

### Requirement: Separate Stats Bar (REMOVED)

Commands 模块 SHALL NOT 显示独立的统计信息栏。

#### Scenario: No separate stats bar
- **GIVEN** 用户在 Commands 已安装模式
- **WHEN** 查看页面布局
- **THEN** 不显示独立的 glass 样式统计栏
- **AND** 统计信息整合到搜索行中
