# CC Switch UX 改进与 Bug 修复规格说明书

> **版本**: v1.0
> **创建日期**: 2026-01-10
> **优先级**: 高
> **状态**: 待实现

---

## 1. 概述

### 1.1 背景

CC Switch 的 Skills、Commands、Agents、Hooks 管理页面存在多个用户体验问题和功能缺失，需要进行系统性的修复和优化。

### 1.2 目标

本规格说明覆盖以下 8 个改进项（按优先级排序）：

| # | 类型 | 描述 |
|---|------|------|
| 1 | Bug | Commands 右侧详情安装时间显示 1970 年 |
| 2 | Bug | Skills 已安装列表「查看文档」打不开 |
| 3 | UX | 左侧导航展开/折叠行为改进（手风琴模式） |
| 4 | 功能 | Commands/Agents 发现模式默认显示全部 |
| 5 | 功能 | Skills 已安装列表添加内容预览 |
| 6 | 功能 | Agents 已安装列表添加右侧详情面板 |
| 7 | 功能 | Commands/Skills 添加更新次数和最后更新时间 |
| 8 | 其他 | 开发过程中发现的问题 |

### 1.3 优先级说明

遵循 **Bug 优先** 原则：
1. 先修复 Bug（#1, #2）
2. 再改进 UX（#3）
3. 最后实现新功能（#4-#8）

---

## 2. Bug 修复

### 2.1 安装时间显示 1970 年（#1）

#### 问题描述
Commands 右侧详情中的安装时间显示为 1970 年（Unix 时间戳起点），说明时间戳处理有误。

#### 根因分析
可能的原因：
- 安装时未正确记录时间戳
- 时间戳单位不匹配（秒 vs 毫秒）
- 时间戳字段存储为 0 或 null

#### 解决方案
1. 检查数据库中 `installed_at` 字段的存储格式
2. 确保安装时正确写入当前时间戳
3. 前端格式化时统一使用 ISO 8601 格式

#### 时间显示格式
**采用绝对时间**：`2026-01-10 14:30`

```typescript
// src/lib/utils/date.ts
export function formatInstallTime(timestamp: number | string | null): string {
  if (!timestamp || timestamp === 0) {
    return '未知';
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return '未知';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
```

---

### 2.2 Skills 查看文档打不开（#2）

#### 问题描述
Skills 已安装列表页点击「查看文档」按钮无反应或报错。

#### 解决方案
跳转到 **具体文件的 GitHub 页面**。

#### 实现逻辑

```typescript
// 构建 GitHub 文件 URL
function buildGitHubFileUrl(skill: InstalledSkill): string {
  const { repo_url, file_path, branch } = skill;

  // repo_url 格式: https://github.com/owner/repo
  // file_path 格式: skills/my-skill.md
  // 目标 URL: https://github.com/owner/repo/blob/main/skills/my-skill.md

  const repoBase = repo_url.replace(/\.git$/, '');
  const targetBranch = branch || 'main';

  return `${repoBase}/blob/${targetBranch}/${file_path}`;
}

// 打开系统默认浏览器
async function openDocumentation(skill: InstalledSkill) {
  const url = buildGitHubFileUrl(skill);
  await invoke('open_external_url', { url });
}
```

#### 后端实现

```rust
// src-tauri/src/commands/utils.rs
#[tauri::command]
pub async fn open_external_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("无法打开链接: {}", e))
}
```

---

## 3. UX 改进

### 3.1 左侧导航手风琴模式（#3）

#### 当前问题
- 点击仓库后展开子项目，但再次点击仓库不会折叠
- 多个仓库可以同时展开，导致列表过长

#### 目标行为

**手风琴模式**：
1. 点击仓库 A → 展开 A，折叠其他已展开的仓库
2. 再次点击仓库 A → 折叠 A
3. 展开仓库时 → **自动选中该仓库并显示其内容**

#### 状态管理

```typescript
// src/hooks/useTreeNavigation.ts

interface TreeNavigationState {
  expandedRepoId: string | null;  // 只允许一个展开
  selectedItemId: string | null;
}

function useTreeNavigation() {
  const [state, setState] = useState<TreeNavigationState>({
    expandedRepoId: null,
    selectedItemId: null,
  });

  const toggleRepo = useCallback((repoId: string) => {
    setState(prev => {
      const isCurrentlyExpanded = prev.expandedRepoId === repoId;

      if (isCurrentlyExpanded) {
        // 折叠当前仓库
        return {
          expandedRepoId: null,
          selectedItemId: null,  // 清空选中
        };
      } else {
        // 展开新仓库，自动选中
        return {
          expandedRepoId: repoId,
          selectedItemId: repoId,  // 自动选中该仓库
        };
      }
    });
  }, []);

  return { state, toggleRepo };
}
```

#### 适用范围
- Skills 页面左侧导航
- Commands 页面左侧导航
- Hooks 页面左侧导航
- Agents 页面左侧导航

---

## 4. 新功能实现

### 4.1 发现模式默认显示全部（#4）

#### 当前问题
- Commands 发现模式：没选仓库时提示「选择以查看详情」
- Agents 发现模式：提示「选择一个仓库或命名空间以查看智能体」
- 搜索功能在未选择仓库时不可用

#### 目标行为
- **默认显示全部**：进入页面时不需要先选仓库
- **支持全局搜索**：未选择仓库时可搜索全部数据
- **按仓库分组排序**：默认按仓库分组，组内按名称排序

#### 技术方案

**虚拟滚动 + 分批加载**：

| 参数 | 值 |
|------|-----|
| 虚拟滚动库 | @tanstack/react-virtual |
| 每批加载数量 | 50 条 |
| 预加载阈值 | 滚动到距底部 20% 时加载下一批 |

**骨架屏**：
- 采用**列表项形状**骨架屏
- 模拟真实列表项结构：左侧图标占位 + 右侧文字行占位

```typescript
// src/components/ui/list-skeleton.tsx
export function ListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-8 h-8 rounded bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}
```

**搜索范围**：
- 名称（name）
- 描述（description）

```typescript
function filterItems<T extends { name: string; description?: string }>(
  items: T[],
  searchQuery: string
): T[] {
  if (!searchQuery.trim()) return items;

  const query = searchQuery.toLowerCase();
  return items.filter(item =>
    item.name.toLowerCase().includes(query) ||
    (item.description?.toLowerCase().includes(query) ?? false)
  );
}
```

**分组排序逻辑**：

```typescript
function groupAndSortItems<T extends { repo_id: string; name: string }>(
  items: T[]
): T[] {
  // 按 repo_id 分组
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const group = groups.get(item.repo_id) || [];
    group.push(item);
    groups.set(item.repo_id, group);
  }

  // 组内按名称排序，组间按仓库名排序
  const sortedGroups = Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b));

  return sortedGroups.flatMap(([_, items]) =>
    items.sort((a, b) => a.name.localeCompare(b.name))
  );
}
```

#### 虚拟列表实现

```typescript
// src/components/discovery/VirtualList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualDiscoveryList<T>({
  items,
  renderItem,
  loadMore,
  hasMore,
  isLoading,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // 估计每项高度
    overscan: 5,
  });

  // 检测滚动到底部
  useEffect(() => {
    const [lastItem] = virtualizer.getVirtualItems().slice(-1);
    if (!lastItem) return;

    if (
      lastItem.index >= items.length - 1 &&
      hasMore &&
      !isLoading
    ) {
      loadMore();
    }
  }, [virtualizer.getVirtualItems(), hasMore, isLoading]);

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => {
          const isLoaderRow = virtualRow.index > items.length - 1;

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                <ListSkeleton count={3} />
              ) : (
                renderItem(items[virtualRow.index])
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

### 4.2 Skills 已安装内容预览（#5）

#### 当前问题
Skills 已安装列表页右侧详情没有内容预览功能，而 Commands 详情有。

#### 目标行为
- 提供**源码视图**和**渲染视图**两种模式
- 切换按钮位于**内容预览区顶部**
- 默认显示**渲染视图**（更易读）

#### UI 设计

```
┌─────────────────────────────────────────────────┐
│ skill-name                                       │
│ Description...                                   │
├─────────────────────────────────────────────────┤
│ 来源仓库: anthroic-skills                        │
│ 安装时间: 2026-01-10 14:30                       │
│ 更新次数: 3 次 | 最后更新: 2026-01-09 18:20      │
├─────────────────────────────────────────────────┤
│ 内容预览                   [源码] [渲染 ✓]       │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ ## Usage                                    │ │
│ │                                             │ │
│ │ This skill helps you...                     │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│           [查看文档]  [卸载]                     │
└─────────────────────────────────────────────────┘
```

#### 实现

```typescript
// src/components/skills/SkillContentPreview.tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CodeBlock } from '@/components/ui/code-block';
import { MarkdownRenderer } from '@/components/ui/markdown-renderer';

interface SkillContentPreviewProps {
  content: string;
  fileName: string;
}

export function SkillContentPreview({
  content,
  fileName
}: SkillContentPreviewProps) {
  const [view, setView] = useState<'source' | 'rendered'>('rendered');

  return (
    <div className="border rounded-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <span className="text-sm font-medium">内容预览</span>
        <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
          <TabsList className="h-7">
            <TabsTrigger value="source" className="text-xs px-2 h-6">
              源码
            </TabsTrigger>
            <TabsTrigger value="rendered" className="text-xs px-2 h-6">
              渲染
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="p-4 max-h-[400px] overflow-auto">
        {view === 'source' ? (
          <CodeBlock
            code={content}
            language={fileName.endsWith('.md') ? 'markdown' : 'yaml'}
          />
        ) : (
          <MarkdownRenderer content={content} />
        )}
      </div>
    </div>
  );
}
```

---

### 4.3 Agents 已安装右侧详情（#6）

#### 当前问题
Agents 已安装列表没有右侧详情面板，用户无法查看 Agent 的详细配置。

#### 目标行为
参考 Commands/Skills 的右侧详情设计，展示：
- 基本信息（名称、描述、来源）
- **完整配置预览**（tools、model、allowedMCPServers 等）
- 安装时间和更新信息

#### UI 设计

```
┌─────────────────────────────────────────────────┐
│ agent-name                                       │
│ Description of what this agent does...           │
├─────────────────────────────────────────────────┤
│ 来源仓库: custom-agents                          │
│ 安装时间: 2026-01-10 14:30                       │
│ 更新次数: 2 次 | 最后更新: 2026-01-08 10:15      │
├─────────────────────────────────────────────────┤
│ 完整配置                                         │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ name: my-agent                              │ │
│ │ description: ...                            │ │
│ │ tools:                                      │ │
│ │   - Bash                                    │ │
│ │   - Read                                    │ │
│ │   - Write                                   │ │
│ │ model: sonnet                               │ │
│ │ allowedMCPServers:                          │ │
│ │   - serena                                  │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│           [查看文档]  [卸载]                     │
└─────────────────────────────────────────────────┘
```

#### 实现

```typescript
// src/components/agents/AgentDetailPanel.tsx
import { CodeBlock } from '@/components/ui/code-block';
import { formatInstallTime } from '@/lib/utils/date';
import type { InstalledAgent } from '@/types/agent';

interface AgentDetailPanelProps {
  agent: InstalledAgent;
  onUninstall: () => void;
  onViewDocs: () => void;
}

export function AgentDetailPanel({
  agent,
  onUninstall,
  onViewDocs,
}: AgentDetailPanelProps) {
  // 格式化完整配置为 YAML
  const configYaml = formatAgentConfig(agent);

  return (
    <div className="h-full flex flex-col">
      {/* 头部信息 */}
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">{agent.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {agent.description}
        </p>
      </div>

      {/* 元信息 */}
      <div className="p-4 border-b space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">来源仓库</span>
          <span>{agent.repo_name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">安装时间</span>
          <span>{formatInstallTime(agent.installed_at)}</span>
        </div>
        {agent.update_count > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">更新信息</span>
            <span>
              {agent.update_count} 次 | 最后: {formatInstallTime(agent.last_updated_at)}
            </span>
          </div>
        )}
      </div>

      {/* 完整配置 */}
      <div className="flex-1 p-4 overflow-auto">
        <h3 className="text-sm font-medium mb-2">完整配置</h3>
        <CodeBlock code={configYaml} language="yaml" />
      </div>

      {/* 操作按钮 */}
      <div className="p-4 border-t flex gap-2">
        <Button variant="outline" onClick={onViewDocs}>
          查看文档
        </Button>
        <Button variant="destructive" onClick={onUninstall}>
          卸载
        </Button>
      </div>
    </div>
  );
}

function formatAgentConfig(agent: InstalledAgent): string {
  const config = {
    name: agent.name,
    description: agent.description,
    ...(agent.tools && { tools: agent.tools }),
    ...(agent.model && { model: agent.model }),
    ...(agent.allowedMCPServers && { allowedMCPServers: agent.allowedMCPServers }),
    // 其他字段...
  };

  return yaml.stringify(config);
}
```

---

### 4.4 更新次数和最后更新时间（#7）

#### 当前问题
Commands 和 Skills 缺少更新历史信息，用户无法知道资源更新了多少次。

#### 目标行为
- 采用**本地记录追踪**
- 保留最近 **20 次**变更历史
- 在详情页显示**摘要信息**：更新次数 + 最后更新时间

#### 数据库设计

```sql
-- 新增更新历史表
CREATE TABLE resource_update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,      -- 'skill' | 'command' | 'agent' | 'hook'
    resource_id TEXT NOT NULL,        -- 资源唯一标识
    action TEXT NOT NULL,             -- 'install' | 'update' | 'sync'
    changed_files TEXT,               -- JSON: 变更的文件列表
    previous_hash TEXT,               -- 更新前的内容哈希
    current_hash TEXT,                -- 更新后的内容哈希
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- 索引优化查询
    UNIQUE(resource_type, resource_id, created_at)
);

-- 为现有表添加字段（如果不存在）
ALTER TABLE installed_skills ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_skills ADD COLUMN last_updated_at DATETIME;

ALTER TABLE installed_commands ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_commands ADD COLUMN last_updated_at DATETIME;

ALTER TABLE installed_agents ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_agents ADD COLUMN last_updated_at DATETIME;

ALTER TABLE installed_hooks ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_hooks ADD COLUMN last_updated_at DATETIME;
```

#### 历史清理策略

```rust
// src-tauri/src/database/dao/update_history.rs

impl UpdateHistoryDao {
    /// 记录更新历史（自动清理旧记录）
    pub async fn record_update(
        &self,
        resource_type: &str,
        resource_id: &str,
        action: &str,
        changed_files: Option<Vec<String>>,
        previous_hash: Option<&str>,
        current_hash: &str,
    ) -> Result<()> {
        // 1. 插入新记录
        sqlx::query(
            "INSERT INTO resource_update_history
             (resource_type, resource_id, action, changed_files, previous_hash, current_hash)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(resource_type)
        .bind(resource_id)
        .bind(action)
        .bind(changed_files.map(|f| serde_json::to_string(&f).ok()).flatten())
        .bind(previous_hash)
        .bind(current_hash)
        .execute(&self.pool)
        .await?;

        // 2. 清理超过 20 条的旧记录
        sqlx::query(
            "DELETE FROM resource_update_history
             WHERE resource_type = ? AND resource_id = ?
             AND id NOT IN (
                 SELECT id FROM resource_update_history
                 WHERE resource_type = ? AND resource_id = ?
                 ORDER BY created_at DESC
                 LIMIT 20
             )"
        )
        .bind(resource_type)
        .bind(resource_id)
        .bind(resource_type)
        .bind(resource_id)
        .execute(&self.pool)
        .await?;

        // 3. 更新主表的统计字段
        self.update_resource_stats(resource_type, resource_id).await?;

        Ok(())
    }

    /// 更新资源表的统计字段
    async fn update_resource_stats(
        &self,
        resource_type: &str,
        resource_id: &str,
    ) -> Result<()> {
        let table_name = match resource_type {
            "skill" => "installed_skills",
            "command" => "installed_commands",
            "agent" => "installed_agents",
            "hook" => "installed_hooks",
            _ => return Err(anyhow!("Unknown resource type")),
        };

        // 获取更新次数和最后更新时间
        let stats: (i32, String) = sqlx::query_as(
            "SELECT
                COUNT(*) as update_count,
                MAX(created_at) as last_updated_at
             FROM resource_update_history
             WHERE resource_type = ? AND resource_id = ?"
        )
        .bind(resource_type)
        .bind(resource_id)
        .fetch_one(&self.pool)
        .await?;

        // 更新主表
        let query = format!(
            "UPDATE {} SET update_count = ?, last_updated_at = ? WHERE id = ?",
            table_name
        );
        sqlx::query(&query)
            .bind(stats.0)
            .bind(&stats.1)
            .bind(resource_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
```

#### UI 显示

详情页摘要格式：
```
更新次数: 3 次 | 最后更新: 2026-01-09 18:20
```

如果从未更新（update_count = 0），则不显示此行。

---

## 5. 依赖管理

### 5.1 新增依赖

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.10.0"
  }
}
```

### 5.2 安装命令

```bash
pnpm add @tanstack/react-virtual
```

---

## 6. 数据库迁移

### 6.1 迁移脚本

```sql
-- migrations/20260110_add_update_tracking.sql

-- 1. 创建更新历史表
CREATE TABLE IF NOT EXISTS resource_update_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changed_files TEXT,
    previous_hash TEXT,
    current_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_update_history_resource
ON resource_update_history(resource_type, resource_id);

-- 2. 为现有表添加统计字段
-- installed_skills
ALTER TABLE installed_skills ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_skills ADD COLUMN last_updated_at DATETIME;

-- installed_commands
ALTER TABLE installed_commands ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_commands ADD COLUMN last_updated_at DATETIME;

-- installed_agents
ALTER TABLE installed_agents ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_agents ADD COLUMN last_updated_at DATETIME;

-- installed_hooks
ALTER TABLE installed_hooks ADD COLUMN update_count INTEGER DEFAULT 0;
ALTER TABLE installed_hooks ADD COLUMN last_updated_at DATETIME;
```

### 6.2 迁移执行

迁移脚本在应用启动时自动执行，使用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 或检查字段存在性后再添加。

---

## 7. 实现计划

### Phase 1: Bug 修复（1 天）
- [ ] 修复安装时间显示 1970 年问题
- [ ] 修复 Skills 查看文档打不开问题

### Phase 2: UX 改进（1 天）
- [ ] 实现左侧导航手风琴模式
- [ ] 统一四个页面（Skills/Commands/Hooks/Agents）的导航行为

### Phase 3: 虚拟滚动基础设施（1-2 天）
- [ ] 安装 @tanstack/react-virtual
- [ ] 创建 VirtualList 通用组件
- [ ] 创建 ListSkeleton 骨架屏组件

### Phase 4: 发现模式改进（2 天）
- [ ] Commands 发现模式默认显示全部
- [ ] Agents 发现模式默认显示全部
- [ ] 实现分组排序逻辑
- [ ] 实现全局搜索功能

### Phase 5: 详情面板（2 天）
- [ ] Skills 内容预览（双视图切换）
- [ ] Agents 右侧详情面板

### Phase 6: 更新追踪（2 天）
- [ ] 数据库迁移
- [ ] 实现 UpdateHistoryDao
- [ ] 修改安装/同步逻辑记录历史
- [ ] UI 显示更新信息

### Phase 7: 测试与优化（1 天）
- [ ] 单元测试
- [ ] 边界情况测试
- [ ] 性能优化

**预计总工时**：9-10 天

---

## 8. 文件变更清单

### 8.1 后端（Rust）

| 文件 | 变更 |
|------|------|
| `src-tauri/src/database/schema.sql` | 添加 update_history 表和新字段 |
| `src-tauri/src/database/dao/mod.rs` | 新增 update_history 模块 |
| `src-tauri/src/database/dao/update_history.rs` | 新建：更新历史 DAO |
| `src-tauri/src/services/skill.rs` | 修改：记录更新历史 |
| `src-tauri/src/services/command.rs` | 修改：记录更新历史 |
| `src-tauri/src/services/agent.rs` | 修改：记录更新历史 |
| `src-tauri/src/services/hook.rs` | 修改：记录更新历史 |
| `src-tauri/src/commands/utils.rs` | 新增：open_external_url 命令 |

### 8.2 前端（TypeScript/React）

| 文件 | 变更 |
|------|------|
| `src/lib/utils/date.ts` | 新建：时间格式化工具 |
| `src/components/ui/list-skeleton.tsx` | 新建：骨架屏组件 |
| `src/components/ui/virtual-list.tsx` | 新建：虚拟列表组件 |
| `src/components/skills/SkillContentPreview.tsx` | 新建：内容预览组件 |
| `src/components/skills/SkillDetailPanel.tsx` | 修改：添加内容预览 |
| `src/components/agents/AgentDetailPanel.tsx` | 新建：详情面板组件 |
| `src/components/agents/InstalledAgentsList.tsx` | 修改：添加右侧详情 |
| `src/components/commands/CommandsDiscovery.tsx` | 修改：默认显示全部 |
| `src/components/agents/AgentsDiscovery.tsx` | 修改：默认显示全部 |
| `src/hooks/useTreeNavigation.ts` | 新建：手风琴导航 hook |
| `src/components/*/TreeNavigation.tsx` | 修改：使用手风琴模式 |

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 虚拟滚动与现有布局冲突 | UI 错乱 | 充分测试各种容器尺寸 |
| 数据库迁移失败 | 数据丢失 | 迁移前自动备份 |
| 大量历史记录影响性能 | 查询变慢 | 限制 20 条 + 索引优化 |
| GitHub URL 构建错误 | 文档打不开 | 多种 URL 格式兼容处理 |

---

## 10. 验收标准

### 10.1 Bug 修复验收

- [ ] Commands 详情安装时间显示正确的日期时间
- [ ] Skills 「查看文档」点击后在浏览器打开正确的 GitHub 页面

### 10.2 UX 改进验收

- [ ] 点击仓库展开时其他仓库自动折叠
- [ ] 再次点击已展开的仓库会折叠
- [ ] 展开仓库时右侧自动显示该仓库内容

### 10.3 功能验收

- [ ] Commands/Agents 发现模式进入时默认显示全部内容
- [ ] 未选择仓库时可以搜索全部数据
- [ ] Skills 详情有源码/渲染视图切换
- [ ] Agents 已安装列表有右侧详情面板
- [ ] 详情页显示更新次数和最后更新时间（有更新历史时）

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-10 | v1.0 | 初始版本 |
