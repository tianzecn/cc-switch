# skills-management Specification Delta

## ADDED Requirements

### Requirement: Skill Content Preview

系统 SHALL 在 Skills 已安装详情面板中提供内容预览功能，支持源码和渲染两种视图模式。

#### Scenario: Content preview displays in detail panel
- **WHEN** 用户选中一个已安装的 Skill
- **THEN** 详情面板显示内容预览区域
- **AND** 预览区域位于元信息下方

#### Scenario: Source view shows raw content
- **WHEN** 用户切换到「源码」视图
- **THEN** 显示 Skill 文件的原始 Markdown/YAML 源码
- **AND** 使用代码高亮（CodeBlock 组件）

#### Scenario: Rendered view shows formatted content
- **WHEN** 用户切换到「渲染」视图
- **THEN** 显示 Markdown 渲染后的富文本内容
- **AND** 使用 MarkdownRenderer 组件

#### Scenario: View toggle button position
- **WHEN** 内容预览区域渲染
- **THEN** 视图切换按钮（「源码」/「渲染」）位于预览区域顶部右侧
- **AND** 默认选中「渲染」视图

### Requirement: Skills Discovery Default Display All

系统 SHALL 在 Skills 发现模式下默认显示所有可用 Skills，无需先选择仓库。

#### Scenario: Discovery mode shows all skills by default
- **WHEN** 用户进入 Skills 发现模式
- **AND** 未选择任何仓库或命名空间
- **THEN** 右侧列表显示所有可用 Skills
- **AND** 按仓库分组排序

#### Scenario: Global search without repository selection
- **WHEN** 用户在发现模式输入搜索关键词
- **AND** 未选择任何仓库
- **THEN** 搜索范围覆盖所有仓库的 Skills
- **AND** 搜索匹配名称和描述字段

### Requirement: Skills Virtual Scroll

系统 SHALL 对 Skills 列表实现虚拟滚动，优化大数据量场景的性能。

#### Scenario: Virtual scroll for long list
- **WHEN** Skills 列表数据量超过 50 条
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

### Requirement: Skills View Documentation

系统 SHALL 支持从详情面板跳转到 GitHub 查看 Skill 文档。

#### Scenario: View documentation opens browser
- **WHEN** 用户点击 Skill 详情面板的「查看文档」按钮
- **THEN** 系统在默认浏览器中打开该 Skill 文件的 GitHub 页面
- **AND** URL 格式为 `https://github.com/{owner}/{repo}/blob/{branch}/{file_path}`

#### Scenario: Handle various repo URL formats
- **WHEN** 仓库 URL 包含 `.git` 后缀
- **THEN** 系统自动移除 `.git` 后缀后构建 GitHub 文件 URL

## MODIFIED Requirements

### Requirement: Skill Detail Panel

系统 SHALL 提供 Skill 详情面板，显示选中 Skill 的详细信息。

#### Scenario: Detail panel displays metadata
- **WHEN** 用户选中一个 Skill
- **THEN** 详情面板显示：
  - Skill 名称和描述
  - 来源信息（仓库/本地）
  - 安装时间（绝对时间格式：YYYY-MM-DD HH:mm）
  - 目录路径
  - 更新次数和最后更新时间（如有更新历史）

#### Scenario: Detail panel shows content preview
- **WHEN** Skill 有文件内容
- **THEN** 详情面板显示内容预览区域
- **AND** 支持源码和渲染视图切换

#### Scenario: Open in editor action
- **WHEN** 用户点击「在编辑器中打开」按钮
- **THEN** 系统调用外部编辑器打开 Skill 目录

#### Scenario: View documentation action
- **WHEN** 用户点击「查看文档」按钮
- **THEN** 系统在默认浏览器中打开 GitHub 文件页面

#### Scenario: Close detail panel
- **WHEN** 用户点击详情面板的关闭按钮
- **THEN** 详情面板关闭，列表恢复全宽显示
