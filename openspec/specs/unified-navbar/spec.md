# unified-navbar Specification

## Purpose
TBD - created by archiving change refactor-unified-navbar. Update Purpose after archive.
## Requirements
### Requirement: Unified Navbar Component

The system SHALL provide a unified navigation bar component (`UnifiedNavbar`) that is displayed consistently across all pages of the application.

#### Scenario: Navbar renders on all pages
- **WHEN** the user navigates to any page (Providers, Skills, Commands, Hooks, Agents, Prompts, MCP, Settings, Universal)
- **THEN** the unified navbar component is displayed at the top of the page

### Requirement: Three-Row Layout Structure

The unified navbar SHALL have a three-row layout structure with consistent heights.

#### Scenario: First row displays core controls
- **WHEN** the navbar renders
- **THEN** the first row (32px) displays: title area, settings button, ProxyToggle, AppSwitcher, and "+" button

#### Scenario: Second row displays feature navigation buttons
- **WHEN** the navbar renders
- **THEN** the second row (32px) displays feature buttons: Skills, Commands, Hooks, Agents, Prompts, MCP

#### Scenario: Third row displays page-specific actions
- **WHEN** the navbar renders on a page with specific actions
- **THEN** the third row (32px) displays the page-specific action buttons

#### Scenario: Third row preserved when empty
- **WHEN** the navbar renders on a page without specific actions (e.g., Providers, Settings)
- **THEN** the third row is preserved as an empty placeholder to maintain consistent height

### Requirement: Title Area Display Logic

The title area in the first row SHALL display different content based on the current page.

#### Scenario: Home page title display
- **WHEN** the current view is "providers" (home page)
- **THEN** the title area displays "CC Switch" text (clickable to return home), settings button, and UpdateBadge

#### Scenario: Sub-page title display
- **WHEN** the current view is any sub-page (Skills, Commands, Hooks, Agents, Prompts, MCP, Settings, Universal)
- **THEN** the title area displays a back button and the current page title

### Requirement: Back Button Navigation Logic

The back button SHALL navigate to the appropriate parent page based on the current view.

#### Scenario: First-level sub-page returns to home
- **WHEN** the user clicks the back button on Skills, Commands, Hooks, Agents, Prompts, MCP, Settings, or Universal page
- **THEN** the user is navigated back to the Providers (home) page

#### Scenario: Second-level sub-page returns to parent
- **WHEN** the user clicks the back button on SkillsDiscovery page
- **THEN** the user is navigated back to the Skills page

### Requirement: Feature Button Highlighting

The feature buttons in the second row SHALL highlight the current page.

#### Scenario: Current page button is highlighted
- **WHEN** the user is on Skills page
- **THEN** the Skills button in the feature row is highlighted

#### Scenario: Child page inherits parent highlighting
- **WHEN** the user is on SkillsDiscovery page (child of Skills)
- **THEN** the Skills button in the feature row is highlighted

#### Scenario: No highlighting on non-feature pages
- **WHEN** the user is on Providers, Settings, or Universal page
- **THEN** no feature button is highlighted

### Requirement: Feature Button Display

The feature buttons SHALL display both icon and text label in standard view.

#### Scenario: Feature button icon and text display
- **WHEN** the viewport width is 768px or greater
- **THEN** each feature button displays its icon and text label (e.g., Wrench icon + "Skills")

#### Scenario: Responsive feature button display
- **WHEN** the viewport width is less than 768px
- **THEN** each feature button displays only its icon, hiding the text label

### Requirement: Plus Button Behavior

The orange "+" button in the first row SHALL always trigger the Add Provider dialog.

#### Scenario: Plus button opens Add Provider dialog
- **WHEN** the user clicks the "+" button on any page
- **THEN** the Add Provider dialog opens

### Requirement: Page Action Buttons Style

The page-specific action buttons in the third row SHALL use the "outline" button variant.

#### Scenario: Action buttons use outline style
- **WHEN** page-specific action buttons render (e.g., Import, Refresh, Add)
- **THEN** the buttons use the "outline" variant style instead of "ghost"

### Requirement: Page-Specific Action Buttons

Each page SHALL have its own set of action buttons displayed in the third row.

#### Scenario: Skills page actions
- **WHEN** the current view is "skills"
- **THEN** the third row displays "Import" and "Discover" buttons

#### Scenario: SkillsDiscovery page actions
- **WHEN** the current view is "skillsDiscovery"
- **THEN** the third row displays "Refresh" and "Repository Manager" buttons

#### Scenario: Prompts page actions
- **WHEN** the current view is "prompts"
- **THEN** the third row displays "+ Add" button

#### Scenario: MCP page actions
- **WHEN** the current view is "mcp"
- **THEN** the third row displays "Import" and "+ Add" buttons

#### Scenario: Pages without actions
- **WHEN** the current view is "providers", "settings", "commands", "hooks", "agents", or "universal"
- **THEN** the third row is empty (placeholder preserved)

### Requirement: Tauri Drag Region Support

The unified navbar SHALL support Tauri window dragging.

#### Scenario: Drag region preserved
- **WHEN** the navbar renders
- **THEN** the 28px drag region above the navbar is preserved with proper `data-tauri-drag-region` attribute

#### Scenario: Interactive elements exclude drag
- **WHEN** an interactive element (button, toggle, etc.) is rendered within the navbar
- **THEN** the element is excluded from the drag region using `WebkitAppRegion: no-drag`

### Requirement: Proxy and App Switcher Availability

The ProxyToggle and AppSwitcher components SHALL be available on all pages.

#### Scenario: ProxyToggle available everywhere
- **WHEN** the user is on any page
- **THEN** the ProxyToggle component is displayed and functional in the first row

#### Scenario: AppSwitcher available everywhere
- **WHEN** the user is on any page
- **THEN** the AppSwitcher component is displayed and functional in the first row, allowing switching between Claude, Codex, and Gemini

