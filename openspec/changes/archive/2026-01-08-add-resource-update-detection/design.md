# Design: Resource Update Detection

## Context

CC Switch 管理来自 GitHub 仓库的 Skills、Commands、Hooks、Agents 资源。当前系统在安装时下载资源，但没有机制检测远程仓库的后续更新。用户需要手动卸载并重新安装才能获取更新，这既繁琐又容易遗漏重要更新。

**约束条件：**
- GitHub API 未认证限制：60 次/小时
- GitHub API 认证后限制：5000 次/小时
- 用户可能管理数十个已安装资源
- 需要支持多文件资源（如包含多个文件的 skill 目录）

## Goals / Non-Goals

**Goals:**
- 提供用户手动触发的更新检测机制
- 使用 blob SHA 实现精确的文件级别更新检测
- 支持可选的 GitHub Token 配置提升 API 配额
- 提供清晰的更新状态展示和一键更新功能

**Non-Goals:**
- 不实现自动后台更新检测（用户手动触发）
- 不实现本地修改的 diff/merge 功能（直接覆盖）
- 不实现更新历史版本回滚功能（不备份）
- 不实现跨仓库的依赖更新检测

## Decisions

### Decision 1: 使用 blob SHA 进行文件级别更新检测

**选择：** 记录每个已安装文件的 GitHub blob SHA，通过比较检测更新。

**原因：**
- blob SHA 是文件内容的精确标识，避免仓库其他文件变更导致的假阳性
- GitHub Contents API 返回 blob SHA，一次请求即可获取
- 比下载完整文件再 hash 更节省带宽

**替代方案：**
- ❌ 仓库级 commit SHA：仓库任何文件变化都触发更新提示，假阳性太多
- ❌ 文件内容 hash：需要下载文件才能计算，浪费带宽
- ❌ ETag/Last-Modified：不够可靠，CDN 可能返回不一致结果

### Decision 2: 可选 GitHub Token 配置

**选择：** 默认使用未认证 API，用户可在设置中配置 PAT 提升配额。

**原因：**
- 未认证 60 次/小时对少量仓库的用户足够
- 配置 Token 对普通用户有门槛，不应强制
- 重度用户可自行配置获得 5000 次/小时

**Token 存储：** 使用 settings 表加密存储（或集成系统钥匙串）。

### Decision 3: 限制并发检查数为 5

**选择：** 同时最多 5 个并发 API 请求。

**原因：**
- 避免短时间内大量请求触发 GitHub 速率限制
- 5 个并发在速度和稳定性之间取得平衡
- 用户仍能看到实时进度更新

### Decision 4: 直接覆盖更新，不备份

**选择：** 更新时直接用远程版本覆盖本地文件，不创建备份。

**原因：**
- 简化实现，避免备份管理的复杂性
- 用户可通过 git 等工具自行管理本地修改
- 远程仓库本身就是"备份"，用户可随时重新安装

**风险缓解：** 提供清晰的更新确认提示，告知用户本地修改将丢失。

### Decision 5: 分支回退机制

**选择：** 当记录的分支不存在时，自动尝试仓库默认分支。

**原因：**
- 很多仓库从 master 迁移到 main，原分支可能已删除
- 自动回退避免用户手动处理
- 回退后更新数据库中的分支记录

## Data Model

```sql
-- 在各已安装资源表添加字段
ALTER TABLE installed_skills ADD COLUMN installed_blob_sha TEXT;
ALTER TABLE installed_skills ADD COLUMN installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 类似地更新 installed_commands, installed_hooks, installed_agents
```

## API Design

### GitHub API 调用

```rust
// 获取文件 blob SHA
GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
Headers: Authorization: Bearer {token}  // 如果有配置
Response: { sha: "blob_sha", ... }

// 获取最新 commit 信息
GET /repos/{owner}/{repo}/commits/{branch}
Response: { sha, commit: { message, author: { date } } }

// 获取仓库默认分支
GET /repos/{owner}/{repo}
Response: { default_branch: "main" }
```

### Tauri Commands

```rust
#[tauri::command]
async fn check_skill_updates(db: State<Database>) -> Result<Vec<UpdateStatus>, Error>;

#[tauri::command]
async fn update_resource(
    resource_type: ResourceType,
    resource_id: String,
    db: State<Database>
) -> Result<(), Error>;

#[tauri::command]
async fn update_all_resources(
    resource_type: ResourceType,
    db: State<Database>
) -> Result<BatchUpdateResult, Error>;
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Skills Page                            │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Toolbar: [检查更新]                                    │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ UpdateNotificationBar: "发现 5 个更新" [全部更新]       │ │
│  └───────────────────────────────────────────────────────┘ │
│  ┌─────────────────┬─────────────────────────────────────┐ │
│  │ Namespace Tree  │ Skills List                         │ │
│  │                 │ ┌─────────────────────────────────┐ │ │
│  │                 │ │ Skill Item      [UpdateBadge]   │ │ │
│  │                 │ │ commit msg, 2 days ago [Update] │ │ │
│  │                 │ └─────────────────────────────────┘ │ │
│  └─────────────────┴─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| API 配额耗尽 | 提示用户配置 Token；手动触发减少调用频率 |
| 网络不稳定 | 单个失败不影响其他；汇总报告失败列表 |
| 本地修改丢失 | 更新前警告；不备份是用户选择 |
| 分支命名混乱 | 自动回退到默认分支；记录新分支名 |

## Migration Plan

1. **Phase 1**: 数据库迁移
   - 添加新字段，现有记录 blob_sha 为 NULL
   - NULL 表示需要重新检测或假设为最新

2. **Phase 2**: 渐进式采集
   - 新安装的资源自动记录 blob SHA
   - 现有资源首次检查更新时补充记录

3. **Rollback**: 无需回滚
   - 新字段是可选的，不影响现有功能
   - 删除 UI 组件即可禁用功能

## Open Questions

1. ~~是否需要支持私有仓库？~~ → 支持，需要配置 Token
2. ~~多文件资源如何处理？~~ → 任一文件变化即触发更新
3. Token 是否需要加密存储？ → 建议使用系统钥匙串或加密，待确认实现方式
