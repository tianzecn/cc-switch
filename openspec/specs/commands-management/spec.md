# commands-management Specification

## Purpose
TBD - created by archiving change add-builtin-repos. Update Purpose after archive.
## Requirements
### Requirement: Built-in Command Repository Configuration

系统 SHALL 提供内置 Commands 仓库配置功能，预配置官方和推荐的 Commands 仓库，使新用户开箱即用。

#### Scenario: Load built-in command repos from JSON config
- **WHEN** 应用启动时
- **THEN** 系统从 `src-tauri/resources/builtin-repos.json` 加载内置 Commands 仓库配置
- **AND** 配置包含 owner、name、branch、description（多语言）字段

#### Scenario: Initialize built-in command repos on first launch
- **WHEN** 用户首次启动应用（数据库为空）
- **THEN** 系统自动添加所有内置 Commands 仓库到数据库
- **AND** 内置仓库默认启用（enabled=true）
- **AND** 内置仓库标记为 builtin=true
- **AND** 内置仓库的 added_at 设为 0（确保排序在最前）

#### Scenario: Sync new built-in command repos on upgrade
- **WHEN** 应用升级后首次启动
- **AND** JSON 配置中存在数据库中不存在的内置 Commands 仓库
- **THEN** 系统自动添加新的内置仓库
- **AND** 不影响现有仓库配置

#### Scenario: Preserve user modifications to command repos
- **WHEN** 用户修改了内置 Commands 仓库的分支配置
- **AND** 应用升级后重新同步
- **THEN** 系统保留用户的修改
- **AND** 不覆盖用户配置

### Requirement: Built-in Command Repository Protection

系统 SHALL 保护内置 Commands 仓库不被删除，但允许禁用。

#### Scenario: Prevent deletion of built-in command repo
- **WHEN** 用户尝试删除内置 Commands 仓库
- **THEN** 系统阻止删除操作
- **AND** 返回错误信息 "Built-in repositories cannot be deleted"

#### Scenario: Allow disable built-in command repo
- **WHEN** 用户禁用内置 Commands 仓库
- **THEN** 系统允许操作
- **AND** 更新 enabled=false
- **AND** 禁用后该仓库的 Commands 不再被发现

#### Scenario: Allow enable built-in command repo
- **WHEN** 用户启用已禁用的内置 Commands 仓库
- **THEN** 系统允许操作
- **AND** 更新 enabled=true

### Requirement: Restore Default Command Repositories

系统 SHALL 提供恢复默认 Commands 仓库功能，仅添加缺失的内置仓库。

#### Scenario: Restore missing built-in command repos
- **WHEN** 用户点击"恢复默认仓库"按钮
- **AND** 部分内置 Commands 仓库不存在于数据库
- **THEN** 系统添加缺失的内置仓库
- **AND** 不影响现有仓库配置
- **AND** 显示恢复结果（"已恢复 N 个内置仓库"）

#### Scenario: No command repos to restore
- **WHEN** 用户点击"恢复默认仓库"按钮
- **AND** 所有内置 Commands 仓库都已存在
- **THEN** 系统显示提示"所有内置仓库都已存在"
- **AND** 不进行任何修改

#### Scenario: Restore button location in commands
- **WHEN** 用户打开 Commands 仓库管理面板
- **THEN** "恢复默认仓库"按钮显示在面板顶部工具栏

### Requirement: Built-in Command Repository UI Identification

系统 SHALL 在 Commands 仓库管理 UI 中明确标识内置仓库，与用户添加的仓库区分。

#### Scenario: Display built-in badge for command repos
- **WHEN** Commands 仓库管理面板显示仓库列表
- **THEN** 内置仓库旁显示「内置」/「Built-in」标签
- **AND** 标签根据当前语言显示对应文案

#### Scenario: Hide delete button for built-in command repos
- **WHEN** Commands 仓库管理面板显示内置仓库
- **THEN** 不显示删除按钮
- **AND** 显示启用/禁用开关

#### Scenario: Show delete button for user command repos
- **WHEN** Commands 仓库管理面板显示用户添加的仓库
- **THEN** 显示删除按钮
- **AND** 显示启用/禁用开关

#### Scenario: Display command repository description
- **WHEN** Commands 仓库管理面板显示仓库列表
- **AND** 仓库有描述信息
- **THEN** 根据当前语言显示对应描述
- **AND** 无描述时显示占位文本或留空

### Requirement: Command Repository List Sorting

系统 SHALL 按添加时间对 Commands 仓库列表排序，内置仓库始终在最前。

#### Scenario: Sort command repos by added_at ascending
- **WHEN** Commands 仓库管理面板显示仓库列表
- **THEN** 按 added_at 升序排列
- **AND** 内置仓库（added_at=0）显示在最前
- **AND** 用户添加的仓库按添加时间排序

### Requirement: Built-in Command Repository Unavailability Warning

系统 SHALL 在内置 Commands 仓库不可访问时显示警告。

#### Scenario: Display unavailable warning for command repos
- **WHEN** 扫描 Commands 仓库时发现内置仓库不可访问（404/403）
- **THEN** 在仓库列表项旁显示警告图标
- **AND** 显示提示文字"此仓库当前不可访问"

#### Scenario: Unavailable command repo still shows in list
- **WHEN** 内置 Commands 仓库不可访问
- **THEN** 仓库仍显示在列表中
- **AND** 用户可以禁用或保留

### Requirement: Command Repository Management

系统 SHALL 支持管理 Commands 仓库，包括内置仓库和用户添加的仓库。

#### Scenario: Add command repository
- **WHEN** 用户点击"添加仓库"按钮
- **THEN** 显示仓库添加表单
- **AND** 用户填写仓库信息后添加到仓库列表
- **AND** 新添加的仓库标记为 builtin=false

#### Scenario: Remove user command repository
- **WHEN** 用户在非内置仓库上点击删除按钮
- **THEN** 显示确认对话框
- **AND** 用户确认后移除仓库（不影响已安装的 Commands）

#### Scenario: Cannot remove built-in command repository
- **WHEN** 用户尝试删除内置 Commands 仓库
- **THEN** 操作被阻止
- **AND** 显示错误提示"内置仓库无法删除"

#### Scenario: Restore default button in command repo manager
- **WHEN** Commands 仓库管理面板打开
- **THEN** 工具栏显示"恢复默认"按钮
- **AND** 点击后仅添加缺失的内置仓库

