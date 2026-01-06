# Skills Management Specification

## Purpose

定义 Skills 管理页面的功能需求，包括双栏布局、命名空间支持、冲突检测等核心能力。

## ADDED Requirements

### Requirement: Skills Page Two-Column Layout

系统 SHALL 提供双栏布局的 Skills 管理页面，与 Commands/Hooks/Agents 页面保持一致的视觉风格。

#### Scenario: Page renders with two-column layout
- **WHEN** 用户导航到 Skills 页面
- **THEN** 页面显示为双栏布局：左侧为命名空间树（w-64），右侧为 Skills 列表（flex-1）

#### Scenario: Layout adapts to container
- **WHEN** 页面渲染在标准容器中
- **THEN** 容器使用 `max-w-[72rem] h-[calc(100vh-8rem)]` 约束

### Requirement: Skill Namespace Support

系统 SHALL 支持 Skills 的命名空间管理，实现三级结构（仓库 → 命名空间 → Skill）。

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

### Requirement: Skill Namespace Creation

系统 SHALL 允许用户创建新的命名空间用于组织本地 Skills。

#### Scenario: Create namespace via tree toolbar
- **WHEN** 用户点击命名空间树顶部的"+"按钮
- **THEN** 显示命名空间创建输入框
- **AND** 用户输入有效名称并确认后，创建新命名空间

#### Scenario: Namespace name validation
- **WHEN** 用户输入命名空间名称
- **THEN** 系统验证名称格式（仅允许小写字母、数字、连字符，且以字母开头）
- **AND** 无效名称时显示错误提示

#### Scenario: Namespace creation success
- **WHEN** 命名空间创建成功
- **THEN** 树形导航刷新，显示新创建的命名空间节点
- **AND** 显示成功提示消息

### Requirement: Skill Namespace Deletion

系统 SHALL 允许用户删除空的命名空间。

#### Scenario: Delete empty namespace
- **WHEN** 用户在空命名空间节点上点击删除按钮
- **THEN** 显示确认对话框
- **AND** 用户确认后删除命名空间

#### Scenario: Cannot delete non-empty namespace
- **WHEN** 命名空间包含 Skills
- **THEN** 删除按钮不可用或不显示

#### Scenario: Cannot delete root namespace
- **WHEN** 用户尝试删除根命名空间（空字符串命名空间）
- **THEN** 操作被阻止

### Requirement: Skills List Display

系统 SHALL 在右侧面板中显示 Skills 列表，支持选择和操作。

#### Scenario: List item displays skill info
- **WHEN** Skills 列表渲染
- **THEN** 每个列表项显示：
  - Skill 名称
  - 描述（如有）
  - 来源标签（本地/仓库名称）
  - 三应用开关（Claude/Codex/Gemini）
  - 删除按钮

#### Scenario: List item selection
- **WHEN** 用户点击列表项
- **THEN** 列表项高亮显示
- **AND** 右侧显示详情面板（如果空间允许）

#### Scenario: Empty state display
- **WHEN** 当前筛选条件下没有 Skills
- **THEN** 显示空状态提示，包含发现 Skills 的建议操作

### Requirement: Skill Detail Panel

系统 SHALL 提供 Skill 详情面板，显示选中 Skill 的详细信息。

#### Scenario: Detail panel displays metadata
- **WHEN** 用户选中一个 Skill
- **THEN** 详情面板显示：
  - Skill 名称和描述
  - 来源信息（仓库/本地）
  - 安装时间
  - 目录路径

#### Scenario: Detail panel shows README preview
- **WHEN** Skill 有 README 文件
- **THEN** 详情面板显示 README 内容预览

#### Scenario: Open in editor action
- **WHEN** 用户点击"在编辑器中打开"按钮
- **THEN** 系统调用外部编辑器打开 Skill 目录

#### Scenario: Close detail panel
- **WHEN** 用户点击详情面板的关闭按钮
- **THEN** 详情面板关闭，列表恢复全宽显示

### Requirement: Skill Conflict Detection

系统 SHALL 检测并提示 Skill 命名冲突问题。

#### Scenario: Detect cross-repository conflicts
- **WHEN** 不同仓库中存在同名 Skill（相同 directory）
- **THEN** 页面顶部显示冲突警告面板

#### Scenario: Conflict panel displays details
- **WHEN** 存在 Skill 冲突
- **THEN** 冲突面板显示：
  - 冲突的 Skill 名称
  - 来源仓库列表
  - 解决建议

#### Scenario: No conflicts
- **WHEN** 没有 Skill 冲突
- **THEN** 冲突面板不显示

### Requirement: Skills Stats Bar

系统 SHALL 显示 Skills 统计信息栏。

#### Scenario: Stats bar displays counts
- **WHEN** Skills 页面加载
- **THEN** 统计栏显示：
  - 已安装 Skills 总数
  - Claude 启用数量
  - Codex 启用数量
  - Gemini 启用数量

#### Scenario: Stats update on changes
- **WHEN** Skills 安装/卸载或应用开关变更
- **THEN** 统计栏数据实时更新

### Requirement: Skills Header Actions

系统 SHALL 在页面头部提供搜索和操作按钮。

#### Scenario: Search functionality
- **WHEN** 用户在搜索框输入文本
- **THEN** Skills 列表按名称、描述、目录进行过滤

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

### Requirement: Repository Management in Tree

系统 SHALL 支持在命名空间树中管理 Skill 仓库。

#### Scenario: Add repository via tree
- **WHEN** 用户点击"添加仓库"按钮
- **THEN** 显示仓库添加表单
- **AND** 用户填写仓库信息后添加到仓库列表

#### Scenario: Remove repository from tree
- **WHEN** 用户在仓库节点上点击删除按钮
- **THEN** 显示确认对话框
- **AND** 用户确认后移除仓库（不影响已安装的 Skills）

#### Scenario: Repository node displays skill count
- **WHEN** 命名空间树渲染
- **THEN** 每个仓库节点显示其包含的 Skills 数量
