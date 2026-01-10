# Tasks: Add Project Scope Installation

## Phase 1: 基础架构

### 1.1 项目服务

- [ ] **创建 ProjectService 服务** `src-tauri/src/services/project.rs`
  - 实现 `get_all_projects()` 方法
  - 实现 `parse_project_dir()` 解析 jsonl 中的 cwd
  - 实现路径有效性检查
  - 按最后使用时间排序
  - **验证**: 单元测试确保正确解析 `~/.claude/projects/` 目录

- [ ] **添加项目相关命令** `src-tauri/src/commands/project.rs`
  - `get_all_projects` - 获取项目列表
  - 注册到 lib.rs
  - **验证**: 通过 Tauri 开发工具测试命令返回

### 1.2 数据库迁移

- [ ] **修改数据库 schema** `src-tauri/src/database/schema.rs`
  - skills 表添加 `scope TEXT DEFAULT 'global'`
  - skills 表添加 `project_path TEXT`
  - commands、hooks、agents 表同样修改
  - **验证**: 升级版本号，测试迁移逻辑

- [ ] **修改 DAO 层** `src-tauri/src/database/dao/`
  - 更新 InstalledSkill 结构体添加 scope、project_path 字段
  - 更新 CRUD 方法支持新字段
  - commands、hooks、agents 同样修改
  - **验证**: 单元测试确保数据正确读写

### 1.3 前端基础 Hook

- [ ] **创建 useProjects Hook** `src/hooks/useProjects.ts`
  - 使用 TanStack Query 包装 get_all_projects
  - 实现 30 秒缓存策略
  - **验证**: 在 DevTools 中确认 Query 正常工作

- [ ] **创建 API 层** `src/lib/api/project.ts`
  - `getAllProjects()` 函数
  - TypeScript 类型定义
  - **验证**: 类型检查通过

---

## Phase 2: 后端逻辑

### 2.1 安装范围类型定义

- [ ] **定义 InstallScope 枚举** `src-tauri/src/app_config.rs`
  - Global 变体
  - Project(PathBuf) 变体
  - 实现 Serialize/Deserialize
  - **验证**: 序列化测试

### 2.2 Skills 服务修改

- [ ] **修改 SkillService 支持范围** `src-tauri/src/services/skill.rs`
  - `get_install_dir()` 支持 InstallScope 参数
  - `install_with_scope()` 新方法
  - `check_scope_conflict()` 冲突检查
  - `cleanup_project_installations()` 清理项目安装
  - **验证**: 单元测试覆盖全局/项目安装场景

- [ ] **添加范围变更命令** `src-tauri/src/commands/skill.rs`
  - `install_skill_with_scope` - 带范围安装
  - `change_skill_scope` - 修改安装范围
  - **验证**: 集成测试

### 2.3 其他资源服务修改

- [ ] **修改 CommandService** `src-tauri/src/services/command.rs`
  - 同 SkillService 的范围支持
  - **验证**: 单元测试

- [ ] **修改 HookService** `src-tauri/src/services/hook.rs`
  - 同 SkillService 的范围支持
  - **验证**: 单元测试

- [ ] **修改 AgentService** `src-tauri/src/services/agent.rs`
  - 同 SkillService 的范围支持
  - **验证**: 单元测试

---

## Phase 3: 前端 UI

### 3.1 项目选择器组件

- [ ] **创建 ProjectSelector 组件** `src/components/common/ProjectSelector.tsx`
  - 弹窗多选 UI
  - 搜索过滤功能
  - 最近使用时间显示
  - 失效项目标记
  - **验证**: Storybook 或手动测试 UI

### 3.2 范围标签组件

- [ ] **创建 ScopeBadge 组件** `src/components/common/ScopeBadge.tsx`
  - 全局/项目标签展示
  - 多项目折叠展示 `[项目: cc-switch, +2]`
  - 可点击交互
  - **验证**: 各种范围场景的 UI 展示

### 3.3 范围修改弹窗

- [ ] **创建 ScopeModifyDialog 组件** `src/components/common/ScopeModifyDialog.tsx`
  - 当前范围显示
  - 升级/降级选项
  - 项目选择器集成
  - 警告提示
  - **验证**: 完整的范围修改流程测试

### 3.4 Skills 页面集成

- [ ] **修改安装按钮** `src/components/skills/`
  - 改为下拉菜单
  - 默认全局安装选项
  - 安装到项目选项
  - **验证**: 安装流程测试

- [ ] **修改已安装列表** `src/components/skills/`
  - 集成 ScopeBadge 组件
  - 显示范围信息
  - **验证**: 列表展示测试

### 3.5 其他页面集成

- [ ] **Commands 页面集成** `src/components/commands/`
  - 同 Skills 页面修改
  - **验证**: 功能测试

- [ ] **Hooks 页面集成** `src/components/hooks/`
  - 同 Skills 页面修改
  - **验证**: 功能测试

- [ ] **Agents 页面集成** `src/components/agents/`
  - 同 Skills 页面修改
  - **验证**: 功能测试

---

## Phase 4: 测试与优化

### 4.1 测试覆盖

- [ ] **后端单元测试**
  - ProjectService 测试
  - 范围安装测试
  - 范围变更测试
  - 冲突检测测试
  - **验证**: `cargo test` 全部通过

- [ ] **前端组件测试**
  - ProjectSelector 测试
  - ScopeBadge 测试
  - ScopeModifyDialog 测试
  - **验证**: `pnpm test:unit` 全部通过

- [ ] **集成测试**
  - 完整安装流程测试
  - 范围切换流程测试
  - 边界情况测试
  - **验证**: 手动 E2E 测试

### 4.2 性能优化

- [ ] **项目列表优化**
  - 实现虚拟滚动（当项目 > 50 个）
  - 优化搜索过滤性能
  - **验证**: 大量项目场景测试

### 4.3 国际化

- [ ] **添加 i18n 文案** `src/i18n/locales/`
  - 中文文案
  - 英文文案
  - 日文文案
  - **验证**: 语言切换测试

---

## Dependencies

```
Phase 1 (基础架构)
    │
    ├── 1.1 ProjectService ──► 1.3 useProjects
    │
    └── 1.2 数据库迁移 ──► Phase 2 (后端逻辑)
                              │
                              ├── 2.1 类型定义
                              │
                              └── 2.2-2.3 服务修改 ──► Phase 3 (前端 UI)
                                                          │
                                                          └── Phase 4 (测试)
```

## Parallelizable Work

以下任务可以并行执行：

- 1.1 ProjectService 和 1.2 数据库迁移
- 2.2 SkillService 和 2.3 其他服务（各服务独立）
- 3.1-3.3 组件开发（无依赖）
- 3.4-3.5 页面集成（待组件完成后可并行）
