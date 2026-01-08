# Change: Add Resource Update Detection and Installation

## Why

当前 CC Switch 的已安装资源（Skills、Commands、Hooks、Agents）缺乏更新检测机制。用户无法知道远程仓库是否有新版本，也无法方便地更新已安装的资源。这导致用户可能使用过时的配置，错过重要的 bug 修复和功能改进。

## What Changes

- **新增 GitHub API 集成**：通过 blob SHA 比较检测远程仓库更新
- **新增版本追踪**：在已安装资源表中记录安装时的 blob SHA 和时间戳
- **新增检查更新 UI**：每个 Tab 页面顶部添加"检查更新"按钮
- **新增更新状态展示**：顶部通知栏 + 列表项 Badge 双重展示
- **新增批量更新功能**：支持一键全部更新或逐个更新
- **新增 GitHub Token 配置**：可选配置 PAT 提升 API 配额
- **发现模式增强**：已安装资源显示更新状态，可直接更新

## Impact

- Affected specs:
  - `resource-updates` (新增 capability)
  - `skills-management` (MODIFIED - 添加更新相关功能)
- Affected code:
  - `src-tauri/src/database/schema.rs` - 数据库 schema 变更
  - `src-tauri/src/database/dao/*.rs` - DAO 层添加版本字段
  - `src-tauri/src/services/*.rs` - 服务层添加更新检测逻辑
  - `src-tauri/src/commands/*.rs` - 新增 IPC 命令
  - `src/components/*/` - UI 组件更新
  - `src/hooks/` - 新增更新相关 hooks
