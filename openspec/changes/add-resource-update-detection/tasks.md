# Implementation Tasks

## 1. Database Schema Changes
- [ ] 1.1 Add `installed_blob_sha` column to `installed_skills` table
- [ ] 1.2 Add `installed_at` column to `installed_skills` table
- [ ] 1.3 Add same columns to `installed_commands` table
- [ ] 1.4 Add same columns to `installed_hooks` table
- [ ] 1.5 Add same columns to `installed_agents` table
- [ ] 1.6 Add migration script for existing data
- [ ] 1.7 Add `github_pat` setting key for token storage

## 2. DAO Layer Updates
- [ ] 2.1 Update `SkillDao` to handle new version fields
- [ ] 2.2 Update `CommandDao` to handle new version fields
- [ ] 2.3 Update `HookDao` to handle new version fields
- [ ] 2.4 Update `AgentDao` to handle new version fields
- [ ] 2.5 Add `SettingsDao` method for GitHub token CRUD

## 3. GitHub API Service
- [ ] 3.1 Create `GitHubApiService` struct with token support
- [ ] 3.2 Implement `get_blob_sha(owner, repo, branch, path)` method
- [ ] 3.3 Implement `get_latest_commit_info(owner, repo, branch)` method
- [ ] 3.4 Implement `get_repo_default_branch(owner, repo)` method
- [ ] 3.5 Add rate limit handling and error recovery
- [ ] 3.6 Add branch fallback logic (recorded branch → default branch)

## 4. Update Detection Logic
- [ ] 4.1 Create `UpdateChecker` service for each resource type
- [ ] 4.2 Implement parallel check with concurrency limit (5)
- [ ] 4.3 Implement single resource update check
- [ ] 4.4 Implement batch update check with progress reporting
- [ ] 4.5 Handle network errors and unavailable repos gracefully

## 5. Update Execution Logic
- [ ] 5.1 Implement single resource update (download + replace)
- [ ] 5.2 Update SSOT and app directories atomically
- [ ] 5.3 Update database record with new blob SHA
- [ ] 5.4 Implement batch update with partial failure handling
- [ ] 5.5 Handle remote resource deletion detection

## 6. Tauri Commands
- [ ] 6.1 Add `check_skill_updates` command
- [ ] 6.2 Add `check_command_updates` command
- [ ] 6.3 Add `check_hook_updates` command
- [ ] 6.4 Add `check_agent_updates` command
- [ ] 6.5 Add `update_resource` command (generic)
- [ ] 6.6 Add `update_all_resources` command
- [ ] 6.7 Add `get_github_token` / `set_github_token` commands

## 7. Frontend API Layer
- [ ] 7.1 Add update check API wrappers in `src/lib/api/`
- [ ] 7.2 Add update execution API wrappers
- [ ] 7.3 Add GitHub token API wrappers
- [ ] 7.4 Define TypeScript types for update status

## 8. Frontend Hooks
- [ ] 8.1 Create `useUpdateChecker` hook for each resource type
- [ ] 8.2 Create `useUpdateExecution` hook
- [ ] 8.3 Create `useGitHubToken` hook for settings
- [ ] 8.4 Integrate with TanStack Query for caching

## 9. UI Components - Check Updates
- [ ] 9.1 Add "Check Updates" button to Skills page toolbar
- [ ] 9.2 Add "Check Updates" button to Commands page toolbar
- [ ] 9.3 Add "Check Updates" button to Hooks page toolbar
- [ ] 9.4 Add "Check Updates" button to Agents page toolbar
- [ ] 9.5 Create progress dialog component with detailed progress bar

## 10. UI Components - Update Status Display
- [ ] 10.1 Create `UpdateBadge` component for list items
- [ ] 10.2 Create `UpdateNotificationBar` component for page top
- [ ] 10.3 Add update info display (commit message, update time)
- [ ] 10.4 Update discovery mode to show "Installed - Update Available"
- [ ] 10.5 Create Toast notification for check completion

## 11. UI Components - Settings
- [ ] 11.1 Add GitHub Token configuration section in Settings
- [ ] 11.2 Add token validation UI
- [ ] 11.3 Add API quota display

## 12. Error Handling & Edge Cases
- [ ] 12.1 Handle branch rename/deletion gracefully
- [ ] 12.2 Handle repository deletion/privatization
- [ ] 12.3 Handle API rate limit exceeded
- [ ] 12.4 Handle partial update failures
- [ ] 12.5 Add "Remote Deleted" status for orphaned resources

## 13. Testing
- [ ] 13.1 Add unit tests for GitHub API service
- [ ] 13.2 Add unit tests for update checker logic
- [ ] 13.3 Add integration tests for update flow
- [ ] 13.4 Add component tests for update UI

## 14. i18n
- [ ] 14.1 Add Chinese translations for update-related strings
- [ ] 14.2 Add English translations
- [ ] 14.3 Add Japanese translations
