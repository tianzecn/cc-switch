# 内置仓库管理功能规格说明

> **状态**: 待实现
> **创建日期**: 2026-01-09
> **访谈结果汇总**

## 1. 功能概述

为 CC Switch 提供预配置的内置仓库功能，使新用户安装后即可直接使用官方和推荐的 Skills/Commands 资源，同时保留用户自定义仓库的灵活性。

### 目标

1. 提供开箱即用的官方和推荐仓库配置
2. 区分内置仓库与用户添加的仓库
3. 支持内置仓库的禁用（但不可删除）
4. 提供恢复默认仓库的功能
5. 支持软件升级时自动添加新的内置仓库

## 2. 核心决策总结

| 决策项 | 选择 | 说明 |
|--------|------|------|
| 替换策略 | 完全替换 | 删除现有预置仓库，使用新列表 |
| 用户权限 | 允许禁用，不允许删除 | 内置仓库可 toggle 启用状态，但不可从列表删除 |
| 恢复策略 | 仅添加缺失的 | 恢复按钮只添加不存在的内置仓库 |
| 冲突处理 | 内置优先 | 同名资源时内置仓库优先级更高 |
| UI 标识 | 特殊标签 | 显示「内置」/「Built-in」标签 |
| 启用状态 | 不区分应用 | 内置仓库启用/禁用是全局的 |
| 排序规则 | 按添加时间 | 内置仓库视为最早添加 |
| 默认状态 | 全部启用 | 新安装后内置仓库默认全部启用 |
| 分支配置 | 允许用户覆盖 | 内置默认分支，用户可修改 |
| 异常处理 | 显示警告 | 仓库不可用时在 UI 显示警告标识 |
| 版本更新 | 自动添加 | 软件升级后自动添加新的内置仓库 |
| 存储位置 | src-tauri/resources/ | 内置 JSON 配置文件 |
| 描述信息 | 支持多语言 | 中/英/日三语言描述 |
| 测试要求 | 不需要 | 功能相对简单，不需专门测试 |

## 3. 内置仓库列表

### 3.1 Skills 内置仓库

| 仓库 | 分支 | 描述 (中) | 描述 (英) | 描述 (日) |
|------|------|-----------|-----------|-----------|
| anthropics/skills | main | Anthropic 官方 Skills 仓库 | Official Anthropic Skills repository | Anthropic 公式 Skills リポジトリ |
| anthropics/claude-code | main | Claude Code 官方仓库 | Official Claude Code repository | Claude Code 公式リポジトリ |
| nextlevelbuilder/ui-ux-pro-max-skill | main | UI/UX Pro Max 专业技能包 | UI/UX Pro Max professional skill pack | UI/UX Pro Max プロスキルパック |

### 3.2 Commands 内置仓库

| 仓库 | 分支 | 描述 (中) | 描述 (英) | 描述 (日) |
|------|------|-----------|-----------|-----------|
| anthropic-ai/claude-code | main | Anthropic AI Claude Code 仓库 | Anthropic AI Claude Code repository | Anthropic AI Claude Code リポジトリ |
| anthropics/claude-plugins-official | main | Anthropic 官方插件仓库 | Official Anthropic plugins repository | Anthropic 公式プラグインリポジトリ |
| anthropics/claude-code | main | Claude Code 官方仓库 | Official Claude Code repository | Claude Code 公式リポジトリ |
| tianzecn/myclaudecode | main | MyClaudeCode 社区仓库 | MyClaudeCode community repository | MyClaudeCode コミュニティリポジトリ |
| tianzecn/SuperClaude | main | SuperClaude 增强包 | SuperClaude enhancement pack | SuperClaude 拡張パック |

> **注意**: `anthropics/claude-code` 同时出现在 Skills 和 Commands 列表中，因为该仓库包含这两类资源。

## 4. 数据模型设计

### 4.1 JSON 配置文件结构

**文件位置**: `src-tauri/resources/builtin-repos.json`

```json
{
  "version": 1,
  "skills": [
    {
      "owner": "anthropics",
      "name": "skills",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "Anthropic 官方 Skills 仓库",
        "en": "Official Anthropic Skills repository",
        "ja": "Anthropic 公式 Skills リポジトリ"
      }
    },
    {
      "owner": "anthropics",
      "name": "claude-code",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "Claude Code 官方仓库",
        "en": "Official Claude Code repository",
        "ja": "Claude Code 公式リポジトリ"
      }
    },
    {
      "owner": "nextlevelbuilder",
      "name": "ui-ux-pro-max-skill",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "UI/UX Pro Max 专业技能包",
        "en": "UI/UX Pro Max professional skill pack",
        "ja": "UI/UX Pro Max プロスキルパック"
      }
    }
  ],
  "commands": [
    {
      "owner": "anthropic-ai",
      "name": "claude-code",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "Anthropic AI Claude Code 仓库",
        "en": "Anthropic AI Claude Code repository",
        "ja": "Anthropic AI Claude Code リポジトリ"
      }
    },
    {
      "owner": "anthropics",
      "name": "claude-plugins-official",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "Anthropic 官方插件仓库",
        "en": "Official Anthropic plugins repository",
        "ja": "Anthropic 公式プラグインリポジトリ"
      }
    },
    {
      "owner": "anthropics",
      "name": "claude-code",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "Claude Code 官方仓库",
        "en": "Official Claude Code repository",
        "ja": "Claude Code 公式リポジトリ"
      }
    },
    {
      "owner": "tianzecn",
      "name": "myclaudecode",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "MyClaudeCode 社区仓库",
        "en": "MyClaudeCode community repository",
        "ja": "MyClaudeCode コミュニティリポジトリ"
      }
    },
    {
      "owner": "tianzecn",
      "name": "SuperClaude",
      "branch": "main",
      "builtin": true,
      "description": {
        "zh": "SuperClaude 增强包",
        "en": "SuperClaude enhancement pack",
        "ja": "SuperClaude 拡張パック"
      }
    }
  ]
}
```

### 4.2 数据库表变更

在现有 `skill_repos` 和 `command_repos` 表中添加字段：

```sql
-- skill_repos 表添加
ALTER TABLE skill_repos ADD COLUMN builtin BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE skill_repos ADD COLUMN description_zh TEXT;
ALTER TABLE skill_repos ADD COLUMN description_en TEXT;
ALTER TABLE skill_repos ADD COLUMN description_ja TEXT;
ALTER TABLE skill_repos ADD COLUMN added_at INTEGER NOT NULL DEFAULT 0;

-- command_repos 表添加
ALTER TABLE command_repos ADD COLUMN builtin BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE command_repos ADD COLUMN description_zh TEXT;
ALTER TABLE command_repos ADD COLUMN description_en TEXT;
ALTER TABLE command_repos ADD COLUMN description_ja TEXT;
ALTER TABLE command_repos ADD COLUMN added_at INTEGER NOT NULL DEFAULT 0;
```

**字段说明：**
- `builtin`: 是否为内置仓库（true 则不可删除）
- `description_*`: 各语言描述
- `added_at`: 添加时间戳（用于排序，内置仓库为 0）

## 5. 技术架构

### 5.1 初始化流程

```
应用启动
    │
    ▼
读取 builtin-repos.json
    │
    ▼
检查数据库中是否存在内置仓库
    │
    ├─ 不存在 → 插入内置仓库记录（enabled=true, added_at=0）
    │
    └─ 存在 → 检查是否有新增内置仓库
                │
                └─ 有新增 → 自动添加新仓库（enabled=true）
```

### 5.2 升级检测逻辑

```rust
async fn sync_builtin_repos(db: &Database) -> Result<()> {
    let builtin_config = load_builtin_repos_json()?;

    // Skills
    for repo in builtin_config.skills {
        if !db.skill_repo_exists(&repo.owner, &repo.name).await? {
            db.add_skill_repo(SkillRepo {
                owner: repo.owner,
                name: repo.name,
                branch: repo.branch,
                enabled: true,
                builtin: true,
                description_zh: repo.description.zh,
                description_en: repo.description.en,
                description_ja: repo.description.ja,
                added_at: 0, // 内置仓库添加时间为 0
            }).await?;
        }
    }

    // Commands 同理
    // ...
}
```

### 5.3 恢复默认仓库逻辑

```rust
async fn restore_default_repos(db: &Database, repo_type: RepoType) -> Result<RestoredCount> {
    let builtin_config = load_builtin_repos_json()?;
    let repos = match repo_type {
        RepoType::Skills => &builtin_config.skills,
        RepoType::Commands => &builtin_config.commands,
    };

    let mut restored = 0;
    for repo in repos {
        if !db.repo_exists(&repo.owner, &repo.name, repo_type).await? {
            db.add_repo(repo, repo_type).await?;
            restored += 1;
        }
    }

    Ok(RestoredCount(restored))
}
```

## 6. UI/UX 设计

### 6.1 仓库列表展示

```
┌─────────────────────────────────────────────────────────────┐
│  仓库管理                                      [恢复默认]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] anthropics/skills                    [内置]     │   │
│  │     Anthropic 官方 Skills 仓库                      │   │
│  │     分支: main                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] anthropics/claude-code               [内置]     │   │
│  │     Claude Code 官方仓库                            │   │
│  │     分支: main                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [✓] user/custom-repo                       [删除]   │   │
│  │     (无描述)                                        │   │
│  │     分支: main                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                      [+ 添加仓库]           │
└─────────────────────────────────────────────────────────────┘
```

**关键设计点：**
1. 内置仓库显示「内置」标签，不显示删除按钮
2. 用户仓库显示「删除」按钮
3. 所有仓库都有启用/禁用 checkbox
4. 顶部有「恢复默认」按钮
5. 仓库按 `added_at` 排序，内置仓库（added_at=0）在最前

### 6.2 内置标签样式

```tsx
// 标签组件
<Badge variant="secondary" className="text-xs">
  {t('repos.builtin')} {/* 内置 | Built-in | 内蔵 */}
</Badge>
```

### 6.3 恢复默认确认

```
┌─────────────────────────────────────────────────────────────┐
│  恢复默认仓库                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  此操作将添加缺失的内置仓库。                               │
│  已有的仓库配置不会受到影响。                               │
│                                                             │
│                              [取消]  [确认恢复]             │
└─────────────────────────────────────────────────────────────┘
```

### 6.4 仓库不可用警告

当内置仓库在 GitHub 上不可访问时：

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠️ anthropics/deleted-repo                    [内置]       │
│     此仓库当前不可访问                                      │
│     分支: main                                              │
└─────────────────────────────────────────────────────────────┘
```

## 7. i18n 国际化

### 7.1 新增翻译 Key

**中文 (zh)**
```json
{
  "repos": {
    "builtin": "内置",
    "restore_default": "恢复默认",
    "restore_default_title": "恢复默认仓库",
    "restore_default_desc": "此操作将添加缺失的内置仓库。已有的仓库配置不会受到影响。",
    "restore_confirm": "确认恢复",
    "restore_success": "已恢复 {{count}} 个内置仓库",
    "restore_no_change": "所有内置仓库都已存在",
    "unavailable": "此仓库当前不可访问",
    "builtin_no_delete": "内置仓库无法删除"
  }
}
```

**英文 (en)**
```json
{
  "repos": {
    "builtin": "Built-in",
    "restore_default": "Restore Default",
    "restore_default_title": "Restore Default Repos",
    "restore_default_desc": "This will add missing built-in repositories. Existing configurations will not be affected.",
    "restore_confirm": "Confirm Restore",
    "restore_success": "Restored {{count}} built-in repositories",
    "restore_no_change": "All built-in repositories already exist",
    "unavailable": "This repository is currently unavailable",
    "builtin_no_delete": "Built-in repositories cannot be deleted"
  }
}
```

**日文 (ja)**
```json
{
  "repos": {
    "builtin": "内蔵",
    "restore_default": "デフォルトに戻す",
    "restore_default_title": "デフォルトリポジトリを復元",
    "restore_default_desc": "不足している内蔵リポジトリを追加します。既存の設定は影響を受けません。",
    "restore_confirm": "復元を確認",
    "restore_success": "{{count}} 個の内蔵リポジトリを復元しました",
    "restore_no_change": "すべての内蔵リポジトリは既に存在します",
    "unavailable": "このリポジトリは現在利用できません",
    "builtin_no_delete": "内蔵リポジトリは削除できません"
  }
}
```

## 8. API 设计

### 8.1 新增 Tauri Commands

```rust
// 恢复默认仓库
#[tauri::command]
async fn restore_default_skill_repos(
    state: State<'_, AppState>
) -> Result<RestoreResult, String>;

#[tauri::command]
async fn restore_default_command_repos(
    state: State<'_, AppState>
) -> Result<RestoreResult, String>;

// 返回结构
#[derive(Serialize)]
struct RestoreResult {
    restored_count: u32,
    message: String,
}
```

### 8.2 修改现有 Commands

```rust
// 获取仓库列表 - 返回值包含 builtin 字段
#[tauri::command]
async fn get_skill_repos(...) -> Result<Vec<SkillRepoWithMeta>, String>;

#[derive(Serialize)]
struct SkillRepoWithMeta {
    owner: String,
    name: String,
    branch: String,
    enabled: bool,
    builtin: bool,          // 新增
    description: Option<String>, // 新增，根据当前语言返回
    added_at: i64,          // 新增
}

// 删除仓库 - 检查是否为内置
#[tauri::command]
async fn remove_skill_repo(...) -> Result<(), String> {
    // 检查 builtin 字段
    if repo.builtin {
        return Err("Built-in repositories cannot be deleted".into());
    }
    // ...
}
```

## 9. 实现计划

### Phase 1：基础架构
1. [ ] 创建 `builtin-repos.json` 配置文件
2. [ ] 数据库 schema 迁移（添加新字段）
3. [ ] 实现 JSON 配置加载逻辑
4. [ ] 实现内置仓库初始化/同步逻辑

### Phase 2：后端 API
1. [ ] 修改 `get_skill_repos` / `get_command_repos` 返回扩展信息
2. [ ] 修改删除逻辑，阻止删除内置仓库
3. [ ] 实现 `restore_default_*_repos` 命令
4. [ ] 添加分支覆盖支持

### Phase 3：前端实现
1. [ ] 添加「内置」标签组件
2. [ ] 修改仓库管理面板 UI
3. [ ] 实现「恢复默认」按钮和确认对话框
4. [ ] 添加仓库不可用警告显示

### Phase 4：国际化
1. [ ] 添加所有新翻译 key
2. [ ] 实现描述信息的多语言显示

## 10. 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| 内置仓库被用户手动添加过 | 检测到相同 owner/name 时跳过，保留用户配置 |
| 用户修改了内置仓库的分支 | 保留用户修改，不覆盖 |
| 内置仓库在 GitHub 上被删除 | 显示警告标识，保留本地配置 |
| 恢复默认时存在同名用户仓库 | 跳过该仓库，不覆盖用户配置 |
| 数据库迁移失败 | 回滚迁移，保持旧版本运行 |
| JSON 配置文件损坏 | 使用硬编码的默认列表作为 fallback |
| 网络不可用时检查仓库 | 跳过可用性检查，保留现有状态 |

## 11. 与现有功能的兼容性

### 11.1 现有预置仓库处理

**当前 Skills 预置仓库（将被替换）：**
- `anthropics/skills` → 保留
- `ComposioHQ/awesome-claude-skills` → 移除
- `cexll/myclaude` → 移除

**迁移策略：**
1. 首次运行新版本时，标记旧仓库为 `builtin=false`
2. 旧仓库变为普通用户仓库，可正常删除
3. 添加新的内置仓库

### 11.2 数据库迁移

```sql
-- 迁移脚本
-- 1. 添加新字段
ALTER TABLE skill_repos ADD COLUMN builtin BOOLEAN NOT NULL DEFAULT 0;
-- ...

-- 2. 标记现有仓库为非内置
UPDATE skill_repos SET builtin = 0;
UPDATE command_repos SET builtin = 0;

-- 3. 新内置仓库在应用启动时通过代码添加
```

---

## 附录：访谈决策记录

| 问题 | 用户选择 |
|------|---------|
| 替换现有预置仓库还是追加 | 完全替换 |
| anthropics/claude-code 归属 | 同时包含 Skills 和 Commands |
| 用户权限 | 允许禁用，不允许删除 |
| 恢复策略 | 提供手动恢复按钮 |
| 冲突处理 | 内置优先 |
| UI 标识方式 | 特殊标签 |
| 恢复按钮位置 | 仓库管理面板内 |
| 版本更新处理 | 自动添加新内置仓库 |
| 分支配置 | 允许用户覆盖 |
| 仓库异常处理 | 显示警告 |
| 网络环境 | 不需要特殊处理 |
| 应用级启用 | 不区分（全局） |
| 标签文案 | 「内置」/「Built-in」 |
| 恢复行为 | 仅添加缺失的 |
| 存储位置 | src-tauri/resources/ |
| 多语言描述 | 支持 |
| 测试要求 | 不需要 |
| 默认状态 | 全部启用 |
| 列表排序 | 按添加时间（内置最前） |
| 仓库描述 | 添加 |
| 分支确认 | 全部使用 main |
