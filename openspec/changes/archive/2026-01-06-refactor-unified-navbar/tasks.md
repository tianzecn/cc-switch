# Tasks: Refactor Unified Navbar

## 1. Create UnifiedNavbar Component

- [ ] 1.1 Create `src/components/navbar/UnifiedNavbar.tsx` with TypeScript interfaces
- [ ] 1.2 Implement first row layout (title area, settings, ProxyToggle, AppSwitcher, + button)
- [ ] 1.3 Implement title area logic (CC Switch for home, back button + title for sub-pages)
- [ ] 1.4 Implement second row layout (feature buttons with icons + text)
- [ ] 1.5 Implement feature button highlighting logic based on current view
- [ ] 1.6 Implement third row layout (page-specific action buttons placeholder)
- [ ] 1.7 Implement responsive behavior (hide text on narrow screens)
- [ ] 1.8 Add Tauri drag region support

## 2. Add i18n Labels

- [ ] 2.1 Add short labels for feature buttons in `src/i18n/locales/zh/translation.json`
- [ ] 2.2 Add short labels for feature buttons in `src/i18n/locales/en/translation.json`
- [ ] 2.3 Add short labels for feature buttons in `src/i18n/locales/ja/translation.json`

## 3. Integrate into App.tsx

- [ ] 3.1 Import `UnifiedNavbar` component in `App.tsx`
- [ ] 3.2 Remove existing `<header>` code block
- [ ] 3.3 Add `UnifiedNavbar` with proper props (currentView, activeApp, refs, callbacks)
- [ ] 3.4 Adjust `CONTENT_TOP_OFFSET` constant for new navbar height

## 4. Update Page Components

- [ ] 4.1 Remove header logic from `PromptPanel.tsx`
- [ ] 4.2 Remove header logic from `UnifiedMcpPanel.tsx`
- [ ] 4.3 Remove header logic from `UnifiedSkillsPanel.tsx`
- [ ] 4.4 Remove header logic from `SkillsPage.tsx`
- [ ] 4.5 Verify `CommandsPage.tsx` has no conflicting header (may be minimal)
- [ ] 4.6 Verify `HooksPage.tsx` has no conflicting header
- [ ] 4.7 Verify `AgentsPage.tsx` has no conflicting header
- [ ] 4.8 Verify `SettingsPage.tsx` has no conflicting header
- [ ] 4.9 Verify `UniversalProviderPanel.tsx` has no conflicting header

## 5. Style Updates

- [ ] 5.1 Update action buttons in third row to use `variant="outline"`
- [ ] 5.2 Ensure consistent spacing and alignment across all three rows
- [ ] 5.3 Add responsive Tailwind classes for feature buttons (`md:` prefix for text)

## 6. Testing & Validation

- [ ] 6.1 Test navigation from home to each sub-page
- [ ] 6.2 Test back button navigation for all pages
- [ ] 6.3 Test feature button highlighting on all pages
- [ ] 6.4 Test "+" button opens Add Provider dialog on all pages
- [ ] 6.5 Test page-specific action buttons functionality
- [ ] 6.6 Test responsive behavior at different viewport widths
- [ ] 6.7 Test Tauri window dragging with new navbar
- [ ] 6.8 Test ProxyToggle and AppSwitcher on all pages

## 7. Cleanup

- [ ] 7.1 Remove any unused imports from App.tsx
- [ ] 7.2 Remove any dead code from page components
- [ ] 7.3 Run `pnpm format` to ensure code style consistency
- [ ] 7.4 Run `pnpm typecheck` to verify TypeScript types
