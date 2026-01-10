# responsive-layout Specification

## Purpose
TBD - created by archiving change add-responsive-layout. Update Purpose after archive.
## Requirements
### Requirement: Layout Mode State Management

The system SHALL provide layout mode state management supporting "fixed" and "adaptive" modes.

#### Scenario: Default layout mode
- **GIVEN** 用户首次使用应用
- **WHEN** 应用启动
- **THEN** 布局模式默认为「自适应」

#### Scenario: Layout mode persistence
- **GIVEN** 用户已设置布局模式为「固定」
- **WHEN** 用户关闭并重新打开应用
- **THEN** 布局模式保持为「固定」

#### Scenario: Layout mode stored in localStorage
- **GIVEN** 用户更改布局模式
- **WHEN** 模式切换完成
- **THEN** 新模式存储在 localStorage 的 `cc-switch-layout-mode` 键中

### Requirement: Adaptive Layout Width

The system SHALL calculate content area width as 95% of viewport width in adaptive mode, with a maximum of 1920px.

#### Scenario: Adaptive mode width calculation
- **GIVEN** 布局模式为「自适应」
- **WHEN** 内容区渲染
- **THEN** 内容区宽度为视口宽度的 95%

#### Scenario: Adaptive mode maximum width
- **GIVEN** 布局模式为「自适应」
- **AND** 视口宽度大于 2021px（使 95% 超过 1920px）
- **WHEN** 内容区渲染
- **THEN** 内容区宽度限制为 1920px

#### Scenario: Content area centered
- **GIVEN** 布局模式为「自适应」
- **WHEN** 内容区渲染
- **THEN** 内容区水平居中，两侧有均等的边距

### Requirement: Fixed Layout Width

The system SHALL apply preset maximum widths (56rem for standard, 72rem for wide) in fixed layout mode.

#### Scenario: Fixed mode standard width
- **GIVEN** 布局模式为「固定」
- **AND** 页面使用 standard 变体
- **WHEN** 内容区渲染
- **THEN** 内容区最大宽度为 56rem (896px)

#### Scenario: Fixed mode wide width
- **GIVEN** 布局模式为「固定」
- **AND** 页面使用 wide 变体
- **WHEN** 内容区渲染
- **THEN** 内容区最大宽度为 72rem (1152px)

### Requirement: Minimum Window Width

The application window SHALL have a minimum width constraint of 900px to prevent layout collapse.

#### Scenario: Window minimum width constraint
- **GIVEN** 用户尝试缩小窗口
- **WHEN** 窗口宽度达到 900px
- **THEN** 窗口无法继续缩小

### Requirement: Responsive Padding

The content area SHALL apply responsive horizontal padding based on viewport width breakpoints.

#### Scenario: Small viewport padding
- **GIVEN** 视口宽度小于 640px
- **WHEN** 内容区渲染
- **THEN** 内容区水平内边距为 16px (px-4)

#### Scenario: Medium viewport padding
- **GIVEN** 视口宽度在 640px 到 1023px 之间
- **WHEN** 内容区渲染
- **THEN** 内容区水平内边距为 24px (px-6)

#### Scenario: Large viewport padding
- **GIVEN** 视口宽度大于等于 1024px
- **WHEN** 内容区渲染
- **THEN** 内容区水平内边距为 32px (px-8)

### Requirement: Layout Transition Animation

The system SHALL apply smooth CSS transition animations (150ms ease-out) during window resize.

#### Scenario: Width transition on resize
- **GIVEN** 用户正在调整窗口大小
- **WHEN** 内容区宽度变化
- **THEN** 宽度变化应用 150ms 的 ease-out 过渡动画

#### Scenario: Padding transition on resize
- **GIVEN** 用户正在调整窗口大小
- **AND** 视口宽度跨越断点（如从 639px 到 640px）
- **WHEN** 内边距变化
- **THEN** 内边距变化应用 150ms 的 ease-out 过渡动画

### Requirement: Layout Mode Settings UI

The settings page SHALL provide a layout mode toggle option allowing users to switch between modes.

#### Scenario: Layout settings display
- **GIVEN** 用户打开设置页面
- **WHEN** 设置内容渲染
- **THEN** 显示「布局模式」设置项，包含下拉选择器

#### Scenario: Layout mode options
- **GIVEN** 用户点击布局模式下拉选择器
- **WHEN** 下拉菜单展开
- **THEN** 显示两个选项：「自适应」和「固定宽度」

#### Scenario: Layout mode change
- **GIVEN** 用户在设置中选择不同的布局模式
- **WHEN** 选择确认
- **THEN** 所有页面的内容区宽度立即更新为新模式对应的宽度

### Requirement: ContentContainer Component

The system SHALL provide a unified ContentContainer component that encapsulates layout width logic.

#### Scenario: ContentContainer with standard variant
- **GIVEN** 页面使用 ContentContainer 组件
- **AND** variant 属性为 "standard" 或未指定
- **WHEN** 组件渲染
- **THEN** 在固定模式下应用 max-w-[56rem]，在自适应模式下应用 w-[95%] max-w-[1920px]

#### Scenario: ContentContainer with wide variant
- **GIVEN** 页面使用 ContentContainer 组件
- **AND** variant 属性为 "wide"
- **WHEN** 组件渲染
- **THEN** 在固定模式下应用 max-w-[72rem]，在自适应模式下应用 w-[95%] max-w-[1920px]

#### Scenario: ContentContainer accepts className
- **GIVEN** 页面使用 ContentContainer 组件
- **AND** 传入 className 属性
- **WHEN** 组件渲染
- **THEN** className 被追加到容器元素的 class 属性中

### Requirement: Page Layout Consistency

All pages SHALL use the unified ContentContainer component for content area layout.

#### Scenario: All pages use ContentContainer
- **GIVEN** 用户导航到任意页面
- **WHEN** 页面渲染
- **THEN** 页面内容区使用 ContentContainer 组件包裹

#### Scenario: Navbar content alignment
- **GIVEN** 用户在任意页面
- **WHEN** 导航栏和内容区渲染
- **THEN** 导航栏内容与页面内容区宽度对齐

### Requirement: Form and Dialog Width Preservation

Forms and dialogs SHALL maintain fixed widths regardless of layout mode.

#### Scenario: Dialog width unchanged
- **GIVEN** 布局模式为「自适应」
- **WHEN** 任意对话框（Dialog）打开
- **THEN** 对话框保持原有的固定最大宽度（max-w-lg）

#### Scenario: Form input width unchanged
- **GIVEN** 布局模式为「自适应」
- **WHEN** 表单类页面渲染（如 Settings、Provider 编辑）
- **THEN** 表单输入框保持固定宽度，不随内容区变宽

### Requirement: i18n Support

Layout-related text labels SHALL support internationalization in Chinese, English, and Japanese.

#### Scenario: Chinese translation
- **GIVEN** 应用语言设置为中文
- **WHEN** 设置页面渲染
- **THEN** 布局设置项显示「布局模式」、「自适应」、「固定宽度」

#### Scenario: English translation
- **GIVEN** 应用语言设置为英文
- **WHEN** 设置页面渲染
- **THEN** 布局设置项显示 "Layout Mode", "Adaptive", "Fixed Width"

#### Scenario: Japanese translation
- **GIVEN** 应用语言设置为日文
- **WHEN** 设置页面渲染
- **THEN** 布局设置项显示「レイアウトモード」、「アダプティブ」、「固定幅」

