# CC Switch 项目状态

> 本文档记录项目当前进度和下次继续的位置。每次开发会话结束时应更新。
>
> **最后更新**: 2026-01-09

## 当前版本

- **版本号**: 3.9.0-3 (Beta)
- **分支**: main

## 近期完成的工作

### 2026-01-09

- [x] **应用内自动升级功能** - ✅ 全部 6 个阶段已完成
  - Phase 1: CI/CD 配置 - latest.json 生成逻辑
  - Phase 2: 后端服务 - `AppUpdaterService` + Tauri Commands + SQLite 存储
  - Phase 3: 前端 API - `appUpdater.ts` API 封装
  - Phase 4: 前端 UI - `UpdateDialog` 组件 + `useAppUpdater` Hook
  - Phase 5: i18n - 中/英/日三语言翻译
  - Phase 6: 集成 - `AppUpdaterContext` + main.tsx 集成
  - **CI/CD 完善**: 签名密钥配置、从 WiX 切换到 NSIS 打包
  - 实现计划文档: `~/.claude/plans/crystalline-watching-alpaca.md`

- [x] **统一模块 Header 布局** - ✅ OpenSpec 已归档: `2026-01-08-unify-module-header-searchbar`
  - Skills/Commands/Hooks/Agents 四个模块 Header 统一为 Tabs 模式切换 + 右侧按钮组
  - 合并搜索框和统计信息到一行，支持响应式 flex-wrap
  - Discovery 模式内容集成到主页面
  - Header 按钮顺序优化：仓库管理 → 功能按钮 → 模式切换（Tabs 放在最右侧）
  - 完善 Agents 模块国际化支持

### 2026-01-08

- [x] **更新检测体验优化** - 修复三个更新检测机制问题
  - 添加 `gcTime: Infinity` 确保更新检测结果在页面切换后持久保留
  - 添加检查范围提示 toast "正在检查 X 个资源的更新..."
  - 发现模式支持更新徽章显示（Skills, Commands, Agents）

- [x] **Commands/Agents 更新安装功能** - 扩展资源更新功能到 Commands 和 Agents
  - 后端更新命令：`update_command`, `update_commands_batch`, `update_agent`, `update_agents_batch`
  - Hash 修复工具：`fix_commands_hash`, `fix_agents_hash`
  - 前端 Hooks：`useUpdateCommand`, `useUpdateCommandsBatch`, `useUpdateAgent`, `useUpdateAgentsBatch`
  - UI 集成：更新检测按钮和更新通知栏
  - 更新流程保持原有应用启用状态并同步到所有已启用应用
  - 数据库新增 `source_path` 字段用于精确定位更新文件

- [x] **批量卸载功能** - Commands 和 Agents 页面新增批量卸载
  - `useUninstallCommandsBatch`, `useUninstallAgentsBatch` Hooks
  - "全部卸载" 按钮带确认对话框
  - 支持命名空间过滤上下文

### 2026-01-07

- [x] **树形仓库选择功能 (Phase 1)** - ✅ OpenSpec 已归档: `2026-01-07-add-tree-repo-selection`
  - `TreeSelection` 类型定义 (`src/types/tree.ts`)
  - `SkillNamespaceTree` / `SkillDiscoveryTree` 仓库选中支持
  - `GroupedSkillsList` 分组列表组件 (Sticky Headers, 分页)
  - `useBatchInstall` Hook + `BatchInstallButton` 组件
  - 全局搜索自动切换"全部"视图
  - 场景化空状态处理
  - Spec 已更新: `specs/skills-management/spec.md`
- [x] 重构 Skills 页面为命名空间树形结构
- [x] 优化 Skills 页面 UI 布局
- [x] 修复命名空间计算并优化安装体验
- [x] 重构统一导航栏组件

### 2026-01-06

- [x] 添加 OpenSpec 规范配置
- [x] 清理未使用代码

## 进行中的工作

### 高优先级

| 任务 | 状态 | 备注 |
|------|------|------|
| 应用内自动升级测试 | 📋 待测试 | 功能已完成，需要端到端测试 |

### 中优先级

| 任务 | 状态 | 备注 |
|------|------|------|
| Hooks 更新功能 | 📋 待开发 | 将更新功能扩展到 Hooks 模块 |
| 单元测试补充 | 📋 可选 | 为新组件编写测试 |

## 下次继续

### 建议的下一步

1. **应用内升级功能测试**
   - 运行 `pnpm dev` 测试升级对话框 UI
   - 设置测试用 latest.json 验证完整流程
   - 测试跳过版本功能
   - 测试代理配置功能

2. **Hooks 更新功能**
   - 将更新检测和安装功能扩展到 Hooks 模块
   - 复用 Commands/Agents 的实现模式

3. **版本发布**
   - 考虑 v3.9.0 正式版发布准备
   - 整合所有新功能的发布说明

### 上下文恢复清单

- [ ] 检查 git status 了解未提交的更改
- [ ] 运行 `pnpm dev` 启动开发环境测试功能
- [ ] 测试应用内升级对话框: 设置页 → 关于 → 检查更新
- [ ] 查看升级功能实现计划: `~/.claude/plans/crystalline-watching-alpaca.md`

## 技术债务

| 项目 | 优先级 | 描述 |
|------|--------|------|
| 测试覆盖 | 中 | 增加前端组件测试覆盖率 |
| 文档补充 | 低 | API 文档需要更新 |

## 已知问题

| Issue | 状态 | 备注 |
|-------|------|------|
| - | - | - |

## 环境信息

- **Node.js**: 见 `.node-version`
- **pnpm**: 使用 workspace
- **Rust**: stable (Tauri 2 要求)

---

## 更新指南

**何时更新此文档**:
1. 完成重要功能后
2. 开发会话结束时
3. 解决重要 bug 后
4. 架构决策变更后

**更新内容**:
- 移动"进行中"到"近期完成"
- 添加新的"进行中"任务
- 更新"下次继续"建议
- 记录新的技术债务或已知问题
