# scope-installation Specification

## Purpose
TBD - created by archiving change add-project-scope-installation. Update Purpose after archive.
## Requirements
### Requirement: Install Scope Definition

系统 SHALL 支持两种安装范围：全局和项目。

#### Scenario: Global scope installation
- **WHEN** 用户选择全局安装
- **THEN** 资源安装到 `~/.claude/<type>/` 目录
- **AND** 资源同步到 Claude、Codex、Gemini 三个应用

#### Scenario: Project scope installation
- **GIVEN** 用户选择安装到项目 `/path/to/project`
- **WHEN** 执行安装
- **THEN** 资源安装到 `/path/to/project/.claude/<type>/` 目录
- **AND** 资源仅同步到 Claude 应用

#### Scenario: Auto-create .claude directory
- **GIVEN** 目标项目不存在 `.claude` 目录
- **WHEN** 安装资源到该项目
- **THEN** 自动创建 `.claude` 目录及必要的子目录（skills/commands/agents）

### Requirement: Scope Mutual Exclusion

系统 SHALL 强制执行全局和项目安装的互斥原则。

#### Scenario: Block project install when global exists
- **GIVEN** 资源已安装到全局
- **WHEN** 用户尝试安装到项目
- **THEN** 操作被阻止
- **AND** 显示提示：「该资源已安装到全局，所有项目均可使用」

#### Scenario: Allow global upgrade from project
- **GIVEN** 资源已安装到一个或多个项目
- **WHEN** 用户选择升级到全局
- **THEN** 自动删除所有项目级安装
- **AND** 安装到全局
- **AND** 更新数据库记录

#### Scenario: Allow multi-project installation
- **GIVEN** 资源已安装到项目 A
- **WHEN** 用户选择安装到项目 B
- **THEN** 在项目 B 创建独立安装
- **AND** 项目 A 的安装保持不变

### Requirement: Scope Change (Upgrade)

系统 SHALL 支持将项目级安装升级为全局安装。

#### Scenario: Upgrade single project to global
- **GIVEN** 资源仅安装在项目 A
- **WHEN** 用户选择「升级到全局」
- **THEN** 删除项目 A 的安装
- **AND** 安装到全局
- **AND** 数据库记录更新为 scope='global'

#### Scenario: Upgrade multiple projects to global
- **GIVEN** 资源安装在项目 A、B、C
- **WHEN** 用户选择「升级到全局」
- **THEN** 删除项目 A、B、C 的所有安装
- **AND** 安装到全局
- **AND** 数据库中原有的多条项目记录合并为一条全局记录

### Requirement: Scope Change (Downgrade)

系统 SHALL 支持将全局安装降级为项目级安装。

#### Scenario: Downgrade global to single project
- **GIVEN** 资源已安装到全局
- **WHEN** 用户选择「移动到项目」并选择项目 A
- **THEN** 删除全局安装
- **AND** 安装到项目 A
- **AND** 数据库记录更新为 scope='project', project_path=A

#### Scenario: Downgrade global to multiple projects
- **GIVEN** 资源已安装到全局
- **WHEN** 用户选择「移动到项目」并选择项目 A、B
- **THEN** 删除全局安装
- **AND** 分别安装到项目 A、B
- **AND** 数据库创建两条项目级记录

### Requirement: Scope Badge Display

系统 SHALL 在已安装列表中显示资源的安装范围标签。

#### Scenario: Display global badge
- **GIVEN** 资源安装范围为全局
- **WHEN** 显示已安装列表
- **THEN** 资源卡片显示 `[全局]` 标签

#### Scenario: Display single project badge
- **GIVEN** 资源安装到单个项目
- **WHEN** 显示已安装列表
- **THEN** 资源卡片显示 `[项目: <project-name>]` 标签

#### Scenario: Display multi-project badge
- **GIVEN** 资源安装到多个项目（如 A、B、C）
- **WHEN** 显示已安装列表
- **THEN** 资源卡片显示 `[项目: A, B, +1]` 格式的折叠标签

#### Scenario: Clickable badge opens modify dialog
- **GIVEN** 范围标签已显示
- **WHEN** 用户点击标签
- **THEN** 打开范围修改弹窗

### Requirement: Scope Modify Dialog

系统 SHALL 提供范围修改弹窗供用户更改安装范围。

#### Scenario: Display current scope
- **WHEN** 打开范围修改弹窗
- **THEN** 显示当前安装范围
- **AND** 如果是项目安装，显示项目列表

#### Scenario: Show upgrade option for project scope
- **GIVEN** 资源当前为项目安装
- **WHEN** 打开范围修改弹窗
- **THEN** 显示「升级到全局」选项
- **AND** 显示「添加到其他项目」选项

#### Scenario: Show downgrade option for global scope
- **GIVEN** 资源当前为全局安装
- **WHEN** 打开范围修改弹窗
- **THEN** 显示「移动到项目」选项
- **AND** 集成项目选择器

#### Scenario: Warning for scope change
- **GIVEN** 用户选择更改范围
- **WHEN** 确认前
- **THEN** 显示警告：「此操作将删除原位置的安装，确定继续吗？」

### Requirement: Install Button with Scope Option

系统 SHALL 在发现模式的安装按钮中提供范围选择。

#### Scenario: Default global install button
- **WHEN** 显示资源卡片的安装按钮
- **THEN** 按钮默认文案为「安装」
- **AND** 点击直接安装到全局

#### Scenario: Scope dropdown menu
- **GIVEN** 安装按钮有下拉箭头
- **WHEN** 用户点击下拉箭头
- **THEN** 展开菜单显示：
  - 「安装到全局」（推荐）
  - 「安装到项目...」

#### Scenario: Select project for installation
- **GIVEN** 用户选择「安装到项目...」
- **WHEN** 菜单项被点击
- **THEN** 打开项目选择器弹窗

### Requirement: Database Scope Storage

系统 SHALL 在数据库中持久化安装范围信息。

#### Scenario: Store global scope
- **WHEN** 全局安装完成
- **THEN** 数据库记录 scope='global', project_path=NULL

#### Scenario: Store project scope
- **WHEN** 项目安装完成
- **THEN** 数据库记录 scope='project', project_path='<full-path>'

#### Scenario: Multiple project records
- **GIVEN** 同一资源安装到多个项目
- **THEN** 数据库中存在多条记录
- **AND** 每条记录有相同的资源 ID 但不同的 project_path

### Requirement: Orphan Record Handling

系统 SHALL 处理项目路径失效的安装记录。

#### Scenario: Detect orphan records
- **GIVEN** 安装记录的 project_path 指向已删除的目录
- **WHEN** 加载已安装列表
- **THEN** 该记录标记为「项目已删除」状态

#### Scenario: Display orphan records
- **GIVEN** 存在孤儿记录
- **WHEN** 显示已安装列表
- **THEN** 显示该资源但带有警告标记
- **AND** 提供「清理」按钮

#### Scenario: Clean orphan records
- **GIVEN** 用户点击「清理」按钮
- **WHEN** 确认操作
- **THEN** 从数据库删除该记录
- **AND** 刷新列表

