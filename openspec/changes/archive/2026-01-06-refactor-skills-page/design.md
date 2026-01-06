# Design: Skills 页面重构

## Context

CC Switch 的 Commands、Hooks、Agents 页面都采用了统一的双栏布局（左侧树形导航 + 右侧列表），但 Skills 页面仍使用旧的网格卡片布局。为了提供一致的用户体验，需要将 Skills 页面重构为相同的布局模式。

### 当前状态

- **Skills 表结构**：没有 namespace 字段
- **SSOT 目录**：`~/.cc-switch/skills/{skill-name}/` (扁平结构)
- **前端组件**：
  - `SkillsPage.tsx` - 发现页面（网格卡片）
  - `UnifiedSkillsPanel.tsx` - 管理面板（列表）
  - `SkillCard.tsx` - 卡片组件
  - `RepoManagerPanel.tsx` - 仓库管理弹窗

### 目标状态

- **Skills 表结构**：添加 `namespace TEXT NOT NULL DEFAULT ''` 字段
- **SSOT 目录**：`~/.cc-switch/skills/{namespace}/{skill-name}/` (层级结构)
- **前端组件**：
  - `SkillsPage.tsx` - 统一管理页面（双栏布局）
  - `SkillNamespaceTree.tsx` - 左侧树形导航
  - `SkillsList.tsx` - 右侧列表
  - `SkillListItem.tsx` - 列表项
  - `SkillDetailPanel.tsx` - 详情面板

## Goals / Non-Goals

### Goals

- 统一 Skills 页面与其他管理页面的布局和交互模式
- 引入命名空间概念，支持 Skills 的逻辑分组
- 保持向后兼容，现有 Skills 可以正常迁移
- 提供冲突检测机制，避免同名 Skill 问题

### Non-Goals

- 不改变 Skills 的安装/卸载核心逻辑
- 不修改三应用开关的同步机制
- 不引入新的 Skill 文件格式（继续使用 SKILL.md）

## Decisions

### 决策 1：命名空间推断规则

**选择**：从目录结构推断命名空间

**规则**：
- 远程仓库 Skill：使用仓库中的目录路径作为命名空间
  - 例如：`anthropic/skills/code-review/` → namespace = `code-review` 的父目录
- 本地 Skill：用户创建时可选择或创建命名空间
- 根命名空间：使用空字符串 `""` 表示

**替代方案**：
1. 在 SKILL.md 中定义命名空间 - 需要修改文件格式，不兼容现有 Skills
2. 使用 repo_owner/repo_name 作为命名空间 - 过于粗粒度，无法细分仓库内的 Skills

### 决策 2：SSOT 目录结构迁移

**选择**：启动时自动迁移 + 懒迁移

**迁移策略**：
1. 数据库迁移时，设置 `skills_namespace_migration_pending = 'true'`
2. 应用启动时检测迁移标记，扫描 SSOT 目录
3. 将扁平目录中的 Skills 移动到根命名空间子目录
4. 更新数据库记录

**回滚方案**：
- 迁移前备份 skills 表数据
- 保留原始目录结构直到确认迁移成功

### 决策 3：组件复用策略

**选择**：参考 Commands 组件，按需调整

**复用关系**：
| Skills 组件 | 参考来源 | 差异点 |
|------------|---------|--------|
| SkillNamespaceTree | NamespaceTree | 无 category 节点，仅 repo → namespace 两级 |
| SkillsList | CommandsList | 无 category 筛选 |
| SkillListItem | InstalledSkillListItem | 保持现有样式，添加选中状态 |
| SkillDetailPanel | CommandDetailPanel | 简化元数据展示 |

### 决策 4：冲突检测范围

**选择**：跨仓库同名检测 + 同命名空间重复检测

**检测规则**：
1. **跨仓库同名**：不同仓库中存在相同 `directory` 名称的 Skill
2. **同命名空间重复**：同一命名空间下存在相同 `directory` 的 Skill（理论上不应发生）

**解决建议**：
- 显示冲突的 Skill 列表
- 提示用户选择保留哪个或重命名

## Risks / Trade-offs

### 风险 1：数据迁移失败

**风险**：目录迁移过程中出错导致 Skills 丢失

**缓解措施**：
- 迁移前创建完整备份
- 使用事务保证数据库和文件系统的一致性
- 提供手动回滚命令

### 风险 2：向后兼容性

**风险**：旧版本应用无法读取新格式数据库

**缓解措施**：
- Schema version 递增到 7
- 迁移脚本包含版本检查
- 升级文档说明不可逆

### 风险 3：性能影响

**风险**：大量 Skills 时树形结构渲染性能问题

**缓解措施**：
- 使用虚拟列表优化长列表渲染
- 命名空间节点懒加载子节点
- 缓存计算结果 (useMemo)

## Migration Plan

### 阶段 1：数据库迁移 (v7)

```sql
-- 添加 namespace 列
ALTER TABLE skills ADD COLUMN namespace TEXT NOT NULL DEFAULT '';

-- 创建索引
CREATE INDEX idx_skills_namespace ON skills(namespace);
```

### 阶段 2：目录结构迁移

```
迁移前：
~/.cc-switch/skills/
├── my-skill-a/
├── my-skill-b/
└── my-skill-c/

迁移后：
~/.cc-switch/skills/
└── /                  (根命名空间，实际为空字符串)
    ├── my-skill-a/
    ├── my-skill-b/
    └── my-skill-c/
```

### 阶段 3：前端组件切换

1. 创建新组件，与旧组件并存
2. 在 SkillsPage 中切换到新组件
3. 验证功能完整性
4. 删除旧组件

## Open Questions

1. **命名空间命名规则**：是否需要限制命名空间名称格式（如 kebab-case）？
   - 建议：与 Commands 保持一致，使用 `/^[a-z][a-z0-9-]*$/`

2. **空命名空间删除策略**：删除命名空间时是否需要确认？
   - 建议：仅当命名空间为空时才允许删除，且需要确认对话框

3. **导入时的命名空间选择**：从本地导入 Skill 时如何选择命名空间？
   - 建议：提供下拉选择框，默认使用根命名空间
