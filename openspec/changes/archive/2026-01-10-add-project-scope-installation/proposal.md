# Proposal: Add Project Scope Installation

## Summary

为 CC Switch 增加项目级安装功能，允许用户将 Skills、Commands、Hooks、Agents 安装到特定项目（`<project>/.claude/`）而非仅全局（`~/.claude/`）。

## Motivation

当前 CC Switch 的资源安装功能只支持全局安装，但 Claude Code 原生支持项目级配置，不同项目可以有不同的配置。用户需要：

1. 将特定资源仅安装到某些项目，避免污染全局配置
2. 不同项目使用不同版本的同一资源
3. 项目间配置隔离，便于团队协作

## Scope

### In Scope

- 自动发现 Claude Code 项目列表（从 `~/.claude/projects/`）
- 支持资源安装到指定项目
- 支持安装范围切换（全局 ↔ 项目）
- 项目选择器 UI 组件
- 范围标签展示和修改
- 数据库 schema 扩展（scope、project_path 字段）

### Out of Scope

- Codex/Gemini 的项目级安装（它们没有项目概念）
- 项目的手动添加/管理（完全依赖 Claude Code 的项目记录）
- 项目级配置文件编辑（如 `.claude/settings.json`）

## Design Decisions

### 1. 互斥原则

**同一资源不能同时存在于全局和项目中**

| 情况 | 处理方式 |
|------|----------|
| 已安装全局 → 安装到项目 | ❌ 禁止（全局已覆盖所有项目） |
| 已安装项目 → 安装到全局 | ✅ 允许（自动删除所有项目级安装） |
| 已安装项目A → 安装到项目B | ✅ 允许（多项目独立安装） |

### 2. 项目发现机制

从 `~/.claude/projects/` 目录读取项目列表，通过解析 `.jsonl` 文件中的 `cwd` 字段获取真实项目路径。

### 3. 应用同步

- **全局安装**：同步到 Claude + Codex + Gemini
- **项目安装**：仅同步到 Claude（因为项目数据来源于 Claude Code）

### 4. UI 设计

- 安装按钮默认全局，旁边图标可切换为项目安装
- 已安装列表显示范围标签 `[全局]` 或 `[项目: xxx]`
- 点击标签可修改安装范围

## Affected Specs

### New Specs

- `project-discovery` - 项目发现与管理
- `scope-installation` - 安装范围管理

### Modified Specs

- `skills-management` - 需要添加范围相关的要求

## Risks and Mitigations

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Claude Code 更新 projects 结构 | 项目列表解析失败 | 版本检测 + 容错设计 |
| 项目路径包含特殊字符 | 安装路径错误 | 路径转义 + 验证 |
| 大量项目导致列表过长 | UI 卡顿 | 虚拟滚动 + 搜索过滤 |
| 用户误操作删除全局安装 | 资源丢失 | 操作确认弹窗 |

## References

- 详细规格说明书: `plans/project-scope-installation-spec.md`
- Claude Code 官方文档：项目级配置说明
