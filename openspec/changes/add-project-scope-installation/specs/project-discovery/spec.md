# project-discovery Specification

## Purpose

提供 Claude Code 项目的自动发现和管理功能，从 `~/.claude/projects/` 目录读取用户使用过的项目列表。

## ADDED Requirements

### Requirement: Project List Discovery

系统 SHALL 自动发现用户通过 Claude Code 使用过的所有项目。

#### Scenario: Discover projects from Claude directory
- **GIVEN** 用户系统中存在 `~/.claude/projects/` 目录
- **WHEN** 系统调用项目列表接口
- **THEN** 返回该目录下所有有效项目的信息列表

#### Scenario: Parse project path from jsonl
- **GIVEN** 项目目录下存在 `.jsonl` 对话记录文件
- **WHEN** 解析项目信息
- **THEN** 从 jsonl 文件中读取 `cwd` 字段作为真实项目路径

#### Scenario: Handle empty projects directory
- **GIVEN** `~/.claude/projects/` 目录为空或不存在
- **WHEN** 系统调用项目列表接口
- **THEN** 返回空列表，不报错

### Requirement: Project Path Validation

系统 SHALL 验证项目路径的有效性并标记失效项目。

#### Scenario: Validate existing project path
- **GIVEN** 项目的 cwd 路径指向存在的目录
- **WHEN** 获取项目列表
- **THEN** 项目的 `is_valid` 字段为 `true`

#### Scenario: Mark deleted project
- **GIVEN** 项目的 cwd 路径指向已删除的目录
- **WHEN** 获取项目列表
- **THEN** 项目的 `is_valid` 字段为 `false`
- **AND** 项目仍包含在列表中（用于显示历史记录）

#### Scenario: Filter .claude directory
- **GIVEN** 项目列表中包含 `~/.claude` 路径
- **WHEN** 获取项目列表
- **THEN** 该路径被过滤掉（这是配置目录，不是项目）

### Requirement: Project Sorting

系统 SHALL 按最近使用时间对项目列表排序。

#### Scenario: Sort by last used time
- **GIVEN** 多个项目有不同的最后使用时间
- **WHEN** 获取项目列表
- **THEN** 列表按最后使用时间降序排列
- **AND** 最近使用的项目排在前面

#### Scenario: Determine last used time
- **GIVEN** 项目目录下有多个 `.jsonl` 文件
- **WHEN** 计算最后使用时间
- **THEN** 使用所有 jsonl 文件中最新的修改时间

### Requirement: Project Info Structure

系统 SHALL 返回包含完整项目信息的结构化数据。

#### Scenario: Return complete project info
- **WHEN** 获取单个项目信息
- **THEN** 返回结构包含：
  - `path`: 项目完整路径
  - `name`: 项目名称（目录名）
  - `lastUsed`: 最后使用时间（ISO 8601 格式）
  - `isValid`: 路径是否有效

### Requirement: Project Selector UI

系统 SHALL 提供项目选择器弹窗组件供用户选择安装目标项目。

#### Scenario: Display project list in selector
- **WHEN** 打开项目选择器
- **THEN** 显示所有项目，每项包含：
  - 项目名称
  - 完整路径
  - 最近使用时间

#### Scenario: Search filter in selector
- **GIVEN** 项目选择器已打开
- **WHEN** 用户输入搜索关键词
- **THEN** 列表按项目名称和路径进行过滤

#### Scenario: Multi-select projects
- **GIVEN** 项目选择器已打开
- **WHEN** 用户勾选多个项目
- **THEN** 所有选中的项目都被记录
- **AND** 确认按钮可用

#### Scenario: Disable invalid projects
- **GIVEN** 项目列表中有失效项目
- **WHEN** 显示项目选择器
- **THEN** 失效项目显示「已删除」标记
- **AND** 失效项目不可选择
