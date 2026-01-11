# Change: UX 改进与 Bug 修复

## Why

CC Switch 的 Skills、Commands、Agents、Hooks 管理页面存在多个用户体验问题和功能缺失：
1. Bug：安装时间显示 1970 年、查看文档链接失效
2. UX：左侧导航无法折叠、发现模式默认不显示数据
3. 功能缺失：Skills 无内容预览、Agents 无详情面板、无更新追踪

## What Changes

### Bug 修复
- **修复安装时间显示 1970 年**：检查并修复时间戳存储和格式化逻辑
- **修复 Skills 查看文档**：实现跳转到 GitHub 具体文件页面

### UX 改进
- **左侧导航手风琴模式**：点击仓库展开时自动折叠其他，再次点击折叠当前
- **发现模式默认显示全部**：Commands/Agents 发现模式进入时显示全部数据，支持全局搜索
- **虚拟滚动 + 分批加载**：大数据量时使用虚拟列表，每批 50 条

### 功能增强
- **Skills 内容预览**：添加源码/渲染双视图切换
- **Agents 详情面板**：参考 Commands/Skills 实现右侧详情，显示完整配置
- **更新追踪**：本地记录资源更新历史，显示更新次数和最后更新时间（保留最近 20 次）

## Impact

### Affected Specs
- `skills-management`：内容预览、发现模式默认显示全部
- `commands-management`：时间显示修复、发现模式默认显示全部
- `agents-management`（新建）：详情面板
- `tree-navigation`（新建）：手风琴导航
- `resource-updates`：更新追踪字段

### Affected Code
- **Backend**：
  - `src-tauri/src/database/schema.sql`：新增 update_history 表和字段
  - `src-tauri/src/database/dao/`：新增 update_history DAO
  - `src-tauri/src/services/`：修改安装/同步逻辑记录历史
  - `src-tauri/src/commands/utils.rs`：新增 open_external_url 命令
- **Frontend**：
  - `src/lib/utils/date.ts`：时间格式化工具
  - `src/components/ui/`：骨架屏、虚拟列表组件
  - `src/components/skills/`：内容预览组件
  - `src/components/agents/`：详情面板组件
  - `src/hooks/useTreeNavigation.ts`：手风琴导航 hook

### Dependencies
- 新增：`@tanstack/react-virtual` 用于虚拟滚动
