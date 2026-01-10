## 1. 后端基础架构

- [x] 1.1 创建 `src-tauri/resources/builtin-repos.json` 配置文件
- [x] 1.2 实现 JSON 配置加载模块（`src-tauri/src/services/builtin_repos.rs`）
- [x] 1.3 数据库 schema 迁移：为 `skill_repos` 表添加 `builtin`、`description_zh/en/ja`、`added_at` 字段
- [x] 1.4 数据库 schema 迁移：为 `command_repos` 表添加 `builtin`、`description_zh/en/ja`、`added_at` 字段

## 2. 后端服务层

- [x] 2.1 修改 `SkillService::init_default_repos` 逻辑，从 JSON 加载内置仓库
- [x] 2.2 修改 `CommandService::init_default_repos` 逻辑，从 JSON 加载内置仓库
- [x] 2.3 实现内置仓库同步逻辑（启动时检测并添加新内置仓库）
- [x] 2.4 修改 `remove_skill_repo` 阻止删除内置仓库
- [x] 2.5 修改 `remove_command_repo` 阻止删除内置仓库
- [x] 2.6 实现 `restore_builtin_skill_repos` Tauri command
- [x] 2.7 实现 `restore_builtin_command_repos` Tauri command

## 3. 后端 DAO 层

- [x] 3.1 修改 `SkillRepoDao::get_all` 返回扩展字段（builtin、description、added_at）
- [x] 3.2 修改 `CommandRepoDao::get_all` 返回扩展字段
- [x] 3.3 添加 `SkillRepoDao::is_builtin` 查询方法
- [x] 3.4 添加 `CommandRepoDao::is_builtin` 查询方法

## 4. 前端 API 层

- [x] 4.1 更新 `skillsApi.getRepos` 返回类型，添加 builtin/description 字段
- [x] 4.2 更新 `commandsApi.getRepos` 返回类型
- [x] 4.3 添加 `skillsApi.restoreBuiltinRepos` 方法
- [x] 4.4 添加 `commandsApi.restoreBuiltinRepos` 方法

## 5. 前端 UI 组件

- [x] 5.1 使用 Badge 组件显示「内置」标签
- [x] 5.2 修改 `RepoManagerPanel.tsx`：显示内置标签、隐藏删除按钮、添加恢复默认按钮、显示描述
- [x] 5.3 修改 `CommandRepoManager.tsx`：同上
- [x] 5.4 在恢复时使用 toast 提示

## 6. 国际化

- [x] 6.1 添加中文翻译 key（skills.repo.builtin、skills.repo.restoreBuiltin、skills.repo.restoreSuccess、skills.repo.noMissing）
- [x] 6.2 添加英文翻译 key（同上）
- [x] 6.3 添加日文翻译 key（同上）

## 7. 数据迁移

- [x] 7.1 v8->v9 迁移脚本：标记现有仓库为非内置
- [x] 7.2 v8->v9 迁移脚本：为现有记录设置 `added_at` 时间戳

## 8. 验证

- [ ] 8.1 手动测试：新安装场景
- [ ] 8.2 手动测试：升级场景（保留用户配置）
- [ ] 8.3 手动测试：恢复默认功能
- [ ] 8.4 手动测试：禁用/启用内置仓库
- [ ] 8.5 手动测试：尝试删除内置仓库（应被阻止）
