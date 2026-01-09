# i18n-completion Spec Delta

## Purpose

定义 Hooks 和 Agents 模块的国际化完善规范，确保所有用户可见文本都使用 i18n key。

## ADDED Requirements

### Requirement: Common Translation Keys

common 命名空间 SHALL 包含所有共享的翻译 key。

#### Scenario: loadMore key exists
- **GIVEN** 翻译文件加载完成
- **WHEN** 访问 `t("common.loadMore")`
- **THEN** 返回对应语言的 "加载更多" / "Load more" / "もっと見る"

### Requirement: Agents Coming Soon Translation

AgentsPanel 组件 SHALL 使用 i18n key 显示 Coming Soon 内容。

#### Scenario: Coming soon title translated
- **GIVEN** 用户打开 AgentsPanel（Coming Soon 状态）
- **WHEN** 页面渲染
- **THEN** 标题使用 `t("agents.comingSoon.title")` 显示
- **AND** 中文显示 "即将推出"
- **AND** 英文显示 "Coming Soon"

#### Scenario: Coming soon description translated
- **GIVEN** 用户打开 AgentsPanel（Coming Soon 状态）
- **WHEN** 页面渲染
- **THEN** 描述使用 `t("agents.comingSoon.description")` 显示

### Requirement: Agents Namespace Translation

GroupedAgentsList 组件 SHALL 使用 i18n key 显示命名空间名称。

#### Scenario: Root namespace translated
- **GIVEN** Agent 没有命名空间
- **WHEN** 显示命名空间名称
- **THEN** 使用 `t("agents.rootNamespace")` 显示
- **AND** 中文显示 "根"
- **AND** 英文显示 "Root"

#### Scenario: Local agents translated
- **GIVEN** Agent 来自本地（非远程仓库）
- **WHEN** 显示仓库名称
- **THEN** 使用 `t("agents.localAgents")` 显示
- **AND** 中文显示 "本地 Agents"
- **AND** 英文显示 "Local Agents"

### Requirement: Agent List Item Translation

AgentListItem 组件 SHALL 使用 i18n key 显示所有交互文本。

#### Scenario: View docs tooltip translated
- **GIVEN** 用户悬停在 Agent 的文档按钮上
- **WHEN** 显示 tooltip
- **THEN** 使用 `t("agents.viewDocs")` 显示
- **AND** 中文显示 "查看文档"

#### Scenario: Open in editor tooltip translated
- **GIVEN** 用户悬停在 Agent 的编辑按钮上
- **WHEN** 显示 tooltip
- **THEN** 使用 `t("agents.openInEditor")` 显示
- **AND** 中文显示 "在编辑器中打开"

#### Scenario: App unsupported message translated
- **GIVEN** Agent 不支持某个应用
- **WHEN** 显示不支持提示
- **THEN** 使用 `t("agents.appUnsupported")` 显示
- **AND** 中文显示 "应用不支持"

### Requirement: Batch Install Agents Translation

BatchInstallAgentsButton 组件 SHALL 使用 i18n key 显示所有状态文本。

#### Scenario: Installing status translated
- **GIVEN** 批量安装进行中
- **WHEN** 显示安装状态
- **THEN** 使用 `t("agents.batch.installing")` 显示
- **AND** 中文显示 "安装中..."

#### Scenario: Current agent translated
- **GIVEN** 批量安装进行中
- **AND** 当前正在安装名为 "MyAgent" 的 Agent
- **WHEN** 显示当前安装项
- **THEN** 使用 `t("agents.batch.currentAgent", { name: "MyAgent" })` 显示
- **AND** 中文显示 "正在安装: MyAgent"

#### Scenario: Failed count translated
- **GIVEN** 批量安装完成
- **AND** 有 3 个安装失败
- **WHEN** 显示失败数量
- **THEN** 使用 `t("agents.batch.failedCount", { count: 3 })` 显示
- **AND** 中文显示 "3 个失败"

#### Scenario: Install all button translated
- **GIVEN** 用户在发现模式
- **WHEN** 显示批量安装按钮
- **THEN** 使用 `t("agents.batch.installAll")` 显示
- **AND** 中文显示 "全部安装"

#### Scenario: Progress text translated
- **GIVEN** 批量安装进行中
- **AND** 当前是第 5 个，共 10 个
- **WHEN** 显示进度
- **THEN** 使用 `t("agents.batch.progress", { current: 5, total: 10 })` 显示
- **AND** 中文显示 "安装中 5/10"

### Requirement: No Fallback Text in Production

组件 SHALL NOT 在生产环境使用备选文本作为翻译降级方案。

#### Scenario: No fallback text usage
- **GIVEN** 所有翻译 key 都已定义
- **WHEN** 组件使用 `t()` 函数
- **THEN** 不使用 `t(key, defaultValue)` 形式的备选文本
- **AND** 直接使用 `t(key)` 形式

### Requirement: Multi-language Support

所有新增的翻译 key SHALL 在 zh/en/ja 三种语言文件中都有定义。

#### Scenario: Chinese translation exists
- **GIVEN** 新增了翻译 key
- **WHEN** 检查 zh.json
- **THEN** 该 key 存在且有中文值

#### Scenario: English translation exists
- **GIVEN** 新增了翻译 key
- **WHEN** 检查 en.json
- **THEN** 该 key 存在且有英文值

#### Scenario: Japanese translation exists
- **GIVEN** 新增了翻译 key
- **WHEN** 检查 ja.json
- **THEN** 该 key 存在且有日文值
