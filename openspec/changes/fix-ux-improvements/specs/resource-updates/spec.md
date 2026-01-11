# resource-updates Specification Delta

## ADDED Requirements

### Requirement: Local Update History Tracking

系统 SHALL 在本地记录资源的更新历史，用于展示更新次数和最后更新时间。

#### Scenario: Record update history on install
- **WHEN** 用户安装新资源（Skill/Command/Agent/Hook）
- **THEN** 系统在 `resource_update_history` 表中记录一条 action='install' 的记录
- **AND** 记录包含 resource_type、resource_id、current_hash、created_at

#### Scenario: Record update history on sync
- **WHEN** 用户同步已安装资源且内容有变化
- **THEN** 系统在 `resource_update_history` 表中记录一条 action='update' 的记录
- **AND** 记录包含 previous_hash、current_hash、changed_files

#### Scenario: Limit history to 20 records
- **WHEN** 同一资源的历史记录超过 20 条
- **THEN** 系统自动删除最旧的记录
- **AND** 始终保留最近 20 条

#### Scenario: Update summary fields
- **WHEN** 记录更新历史后
- **THEN** 系统更新资源主表的 `update_count` 和 `last_updated_at` 字段
- **AND** `update_count` 为该资源的历史记录总数
- **AND** `last_updated_at` 为最近一条记录的时间

### Requirement: Update Info Display

系统 SHALL 在资源详情面板中显示更新信息摘要。

#### Scenario: Display update summary
- **WHEN** 资源有更新历史（update_count > 0）
- **THEN** 详情面板显示「更新次数: N 次 | 最后更新: YYYY-MM-DD HH:mm」

#### Scenario: Hide update info when no history
- **WHEN** 资源没有更新历史（update_count = 0 或首次安装）
- **THEN** 详情面板不显示更新信息行
- **AND** 仅显示安装时间

### Requirement: Update History Database Schema

系统 SHALL 提供更新历史的数据库结构支持。

#### Scenario: Create update history table
- **WHEN** 应用首次启动或升级
- **THEN** 创建 `resource_update_history` 表
- **AND** 表包含字段：id、resource_type、resource_id、action、changed_files、previous_hash、current_hash、created_at

#### Scenario: Add update fields to resource tables
- **WHEN** 应用首次启动或升级
- **THEN** 为以下表添加 `update_count` 和 `last_updated_at` 字段：
  - installed_skills
  - installed_commands
  - installed_agents
  - installed_hooks
- **AND** 新字段有默认值（update_count=0, last_updated_at=NULL）
- **AND** 不影响现有数据
