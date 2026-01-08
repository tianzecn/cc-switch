## ADDED Requirements

### Requirement: Update Check Trigger

系统 SHALL 提供用户手动触发的更新检测功能，每个资源类型页面（Skills/Commands/Hooks/Agents）独立检查。

#### Scenario: User triggers update check
- **WHEN** 用户点击页面顶部工具栏的"检查更新"按钮
- **THEN** 系统开始检查当前资源类型的所有已安装项目是否有远程更新

#### Scenario: Check progress display
- **WHEN** 更新检查进行中
- **THEN** 显示详细进度条，格式为"已检查 X/Y 个仓库"
- **AND** 每个仓库检查完成后立即更新进度

#### Scenario: Check completion notification
- **WHEN** 更新检查完成
- **THEN** 显示 Toast 通知，内容为"发现 N 个可更新项目"或"所有资源已是最新"

### Requirement: Blob SHA Based Detection

系统 SHALL 使用 GitHub blob SHA 进行文件级别的精确更新检测。

#### Scenario: Record blob SHA on installation
- **WHEN** 用户安装新资源
- **THEN** 系统记录安装文件的 blob SHA 到数据库
- **AND** 记录安装时间戳

#### Scenario: Compare blob SHA for updates
- **WHEN** 系统检查资源更新
- **THEN** 获取远程文件当前的 blob SHA
- **AND** 与已记录的 installed_blob_sha 比较
- **AND** 如果不同则标记为有更新

#### Scenario: Multi-file resource update detection
- **WHEN** 资源包含多个文件（如 skill 目录）
- **THEN** 任一文件的 blob SHA 变化即视为有更新

### Requirement: Update Status Display

系统 SHALL 通过双重展示机制向用户显示更新状态：顶部通知栏和列表项 Badge。

#### Scenario: Top notification bar displays summary
- **WHEN** 检测到有可更新资源
- **THEN** 页面顶部显示通知栏
- **AND** 显示"发现 N 个可更新项目"
- **AND** 提供"全部更新"和"忽略"按钮

#### Scenario: List item shows update badge
- **WHEN** 某个已安装资源有更新可用
- **THEN** 该列表项旁显示"有更新"Badge
- **AND** 显示最新 commit 消息摘要
- **AND** 显示更新时间（如"更新于 2 天前"）

#### Scenario: Discovery mode shows update status
- **WHEN** 用户在发现模式查看已安装且有更新的资源
- **THEN** 显示"已安装 - 有更新"状态标签
- **AND** 安装按钮变为"更新"按钮

### Requirement: Single Resource Update

系统 SHALL 支持单个资源的更新操作。

#### Scenario: Update single resource
- **WHEN** 用户点击资源的"更新"按钮
- **THEN** 系统从远程下载最新版本
- **AND** 更新 SSOT 目录中的文件
- **AND** 更新所有应用目录中的副本
- **AND** 更新数据库中的 blob SHA 和时间戳

#### Scenario: Update overwrites local changes
- **WHEN** 本地文件与安装时不同（用户修改过）
- **THEN** 直接用远程版本覆盖，不备份

#### Scenario: Update success feedback
- **WHEN** 资源更新成功
- **THEN** 刷新列表项状态为"最新"
- **AND** 显示成功 Toast 通知

### Requirement: Batch Update

系统 SHALL 支持批量更新所有有更新的资源。

#### Scenario: Update all resources
- **WHEN** 用户点击"全部更新"按钮
- **THEN** 系统并发更新所有标记为有更新的资源
- **AND** 最多 5 个并发
- **AND** 显示批量更新进度

#### Scenario: Partial failure handling
- **WHEN** 批量更新中某个资源更新失败
- **THEN** 跳过失败的资源，继续处理其他
- **AND** 完成后汇总报告成功和失败数量
- **AND** 列出失败资源及原因

### Requirement: GitHub Token Configuration

系统 SHALL 支持可选的 GitHub Personal Access Token 配置，用于提升 API 配额。

#### Scenario: Configure GitHub token
- **WHEN** 用户在设置页面输入 GitHub PAT
- **THEN** 系统安全存储 Token
- **AND** 后续 API 请求使用该 Token 认证

#### Scenario: Validate token
- **WHEN** 用户点击"验证 Token"按钮
- **THEN** 系统调用 GitHub API 验证 Token 有效性
- **AND** 显示验证结果和剩余配额

#### Scenario: Fallback without token
- **WHEN** 未配置 Token
- **THEN** 使用未认证 API（60 次/小时限制）
- **AND** 功能正常工作

### Requirement: Concurrent Check Control

系统 SHALL 限制并发 API 请求数量以避免触发速率限制。

#### Scenario: Limit concurrent checks
- **WHEN** 需要检查多个仓库的更新
- **THEN** 最多同时进行 5 个并发请求
- **AND** 其他请求排队等待

#### Scenario: Real-time progress update
- **WHEN** 某个仓库检查完成
- **THEN** 立即更新进度显示
- **AND** 立即开始下一个排队的请求

### Requirement: Branch Fallback

系统 SHALL 在记录的分支不可访问时自动回退到仓库默认分支。

#### Scenario: Branch not found fallback
- **WHEN** 记录的 repo_branch 在远程不存在
- **THEN** 自动获取仓库的默认分支
- **AND** 使用默认分支继续检查

#### Scenario: Update branch record
- **WHEN** 成功回退到默认分支并完成更新
- **THEN** 更新数据库中的 repo_branch 为新分支名

### Requirement: Remote Deletion Handling

系统 SHALL 检测并处理远程资源被删除的情况。

#### Scenario: Detect remote deletion
- **WHEN** 已安装资源在远程仓库中被删除
- **THEN** 标记该资源为"远程已删除"状态

#### Scenario: Suggest uninstallation
- **WHEN** 资源被标记为"远程已删除"
- **THEN** 显示建议信息："此资源在远程仓库中已不存在，建议卸载本地副本"
- **AND** 提供一键卸载按钮

### Requirement: Network Error Handling

系统 SHALL 优雅处理网络错误和 API 失败。

#### Scenario: Individual check failure
- **WHEN** 检查某个仓库时发生网络错误
- **THEN** 该仓库标记为"检查失败"
- **AND** 继续检查其他仓库

#### Scenario: Aggregate error report
- **WHEN** 批量检查完成且有失败
- **THEN** 在结果中列出所有失败的仓库
- **AND** 显示失败原因（如 403、404、网络超时）

#### Scenario: Rate limit handling
- **WHEN** 遇到 GitHub API 速率限制（429）
- **THEN** 显示友好提示
- **AND** 建议用户配置 GitHub Token
