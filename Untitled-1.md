PS C:\vscode\claude\cc-switch> pnpm dev

> cc-switch@3.12.3 dev C:\vscode\claude\cc-switch
> pnpm tauri dev


> cc-switch@3.12.3 tauri C:\vscode\claude\cc-switch
> tauri "dev"

     Running BeforeDevCommand (`pnpm run dev:renderer`)

> cc-switch@3.12.3 dev:renderer C:\vscode\claude\cc-switch
> vite

1:37:46 PM [vite] (client) Re-optimizing dependencies because lockfile has changed

  VITE v7.3.0  ready in 614 ms

  ➜  Local:   http://localhost:3000/
  ➜  Network: use --host to expose
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
     Running DevCommand (`cargo  run --no-default-features --color always --`)
        Info Watching C:\vscode\claude\cc-switch\src-tauri for changes...
warning: unused import: `params`
 --> src\database\schema.rs:7:16
  |
7 | use rusqlite::{params, Connection};
  |                ^^^^^^
  |
  = note: `#[warn(unused_imports)]` (part of `#[warn(unused)]`) on by default

warning: unused import: `reqwest::Client`
  --> src\services\skill.rs:11:5
   |
11 | use reqwest::Client;
   |     ^^^^^^^^^^^^^^^

warning: unused imports: `AppUpdaterService`, `SkippedVersion`, and `UpdaterConfig`
  --> src\services\mod.rs:26:23
   |
26 | pub use app_updater::{AppUpdaterService, SkippedVersion, UpdaterConfig};
   |                       ^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^^^^  ^^^^^^^^^^^^^

warning: use of deprecated associated function `services::skill::SkillService::copy_to_app`: 请使用 sync_to_app_dir() 代替
   --> src\commands\update.rs:487:39
    |
487 |                 let _ = SkillService::copy_to_app(&installed.directory, &AppType::Claude);
    |                                       ^^^^^^^^^^^
    |
    = note: `#[warn(deprecated)]` on by default

warning: use of deprecated associated function `services::skill::SkillService::copy_to_app`: 请使用 sync_to_app_dir() 代替
   --> src\commands\update.rs:490:39
    |
490 |                 let _ = SkillService::copy_to_app(&installed.directory, &AppType::Codex);
    |                                       ^^^^^^^^^^^

warning: use of deprecated associated function `services::skill::SkillService::copy_to_app`: 请使用 sync_to_app_dir() 代替
   --> src\commands\update.rs:493:39
    |
493 |                 let _ = SkillService::copy_to_app(&installed.directory, &AppType::Gemini);
    |                                       ^^^^^^^^^^^

warning: use of deprecated associated function `services::skill::SkillService::copy_to_app`: 请使用 sync_to_app_dir() 代替
   --> src\services\skill.rs:932:23
    |
932 |                 Self::copy_to_app(&install_name, current_app)?;
    |                       ^^^^^^^^^^^

warning: use of deprecated associated function `services::skill::SkillService::copy_to_app`: 请使用 sync_to_app_dir() 代替
   --> src\services\skill.rs:990:23
    |
990 |                 Self::copy_to_app(&skill.directory, current_app)?;      
    |                       ^^^^^^^^^^^

warning: unused import: `std::io::Write`
 --> src\settings.rs:3:5
  |
3 | use std::io::Write;
  |     ^^^^^^^^^^^^^^

warning: unused variable: `doc_path`
    --> src\services\skill.rs:1774:9
     |
1774 |         doc_path: &str,
     |         ^^^^^^^^ help: if this is intentional, prefix it with an underscore: `_doc_path`
     |
     = note: `#[warn(unused_variables)]` (part of `#[warn(unused)]`) on by default

warning: constant `VALID_TOOLS` is never used
  --> src\commands\misc.rs:95:7
   |
95 | const VALID_TOOLS: [&str; 4] = ["claude", "codex", "gemini", "opencode"];
   |       ^^^^^^^^^^^
   |
   = note: `#[warn(dead_code)]` (part of `#[warn(unused)]`) on by default     

warning: function `tool_env_type_and_wsl_distro` is never used
   --> src\commands\misc.rs:108:4
    |
108 | fn tool_env_type_and_wsl_distro(tool: &str) -> (String, Option<String>) {
    |    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `get_single_tool_version_impl` is never used
   --> src\commands\misc.rs:173:10
    |
173 | async fn get_single_tool_version_impl(
    |          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `fetch_npm_latest_version` is never used
   --> src\commands\misc.rs:221:10
    |
221 | async fn fetch_npm_latest_version(client: &reqwest::Client, package: &str) -> Option<String> {
    |          ^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `fetch_github_latest_version` is never used
   --> src\commands\misc.rs:239:10
    |
239 | async fn fetch_github_latest_version(client: &reqwest::Client, repo: &str) -> Option<String> {
    |          ^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: static `VERSION_RE` is never used
   --> src\commands\misc.rs:262:8
    |
262 | static VERSION_RE: Lazy<Regex> =
    |        ^^^^^^^^^^

warning: function `extract_version` is never used
   --> src\commands\misc.rs:266:4
    |
266 | fn extract_version(raw: &str) -> String {
    |    ^^^^^^^^^^^^^^^

warning: function `try_get_version` is never used
   --> src\commands\misc.rs:274:4
    |
274 | fn try_get_version(tool: &str) -> (Option<String>, Option<String>) {    
    |    ^^^^^^^^^^^^^^^

warning: function `is_valid_wsl_distro_name` is never used
   --> src\commands\misc.rs:323:4
    |
323 | fn is_valid_wsl_distro_name(name: &str) -> bool {
    |    ^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `is_valid_shell` is never used
   --> src\commands\misc.rs:333:4
    |
333 | fn is_valid_shell(shell: &str) -> bool {
    |    ^^^^^^^^^^^^^^

warning: function `is_valid_shell_flag` is never used
   --> src\commands\misc.rs:342:4
    |
342 | fn is_valid_shell_flag(flag: &str) -> bool {
    |    ^^^^^^^^^^^^^^^^^^^

warning: function `default_flag_for_shell` is never used
   --> src\commands\misc.rs:348:4
    |
348 | fn default_flag_for_shell(shell: &str) -> &'static str {
    |    ^^^^^^^^^^^^^^^^^^^^^^

warning: function `try_get_version_wsl` is never used
   --> src\commands\misc.rs:357:4
    |
357 | fn try_get_version_wsl(
    |    ^^^^^^^^^^^^^^^^^^^

warning: function `push_unique_path` is never used
   --> src\commands\misc.rs:469:4
    |
469 | fn push_unique_path(paths: &mut Vec<std::path::PathBuf>, path: std::path::PathBuf) {
    |    ^^^^^^^^^^^^^^^^

warning: function `push_env_single_dir` is never used
   --> src\commands\misc.rs:479:4
    |
479 | fn push_env_single_dir(paths: &mut Vec<std::path::PathBuf>, value: Option<std::ffi::OsString>) {
    |    ^^^^^^^^^^^^^^^^^^^

warning: function `extend_from_path_list` is never used
   --> src\commands\misc.rs:485:4
    |
485 | fn extend_from_path_list(
    |    ^^^^^^^^^^^^^^^^^^^^^

warning: function `opencode_extra_search_paths` is never used
   --> src\commands\misc.rs:504:4
    |
504 | fn opencode_extra_search_paths(
    |    ^^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `tool_executable_candidates` is never used
   --> src\commands\misc.rs:526:4
    |
526 | fn tool_executable_candidates(tool: &str, dir: &Path) -> Vec<std::path::PathBuf> {
    |    ^^^^^^^^^^^^^^^^^^^^^^^^^^

warning: function `scan_cli_version` is never used
   --> src\commands\misc.rs:543:4
    |
543 | fn scan_cli_version(tool: &str) -> (Option<String>, Option<String>) {   
    |    ^^^^^^^^^^^^^^^^

warning: function `wsl_distro_for_tool` is never used
   --> src\commands\misc.rs:674:4
    |
674 | fn wsl_distro_for_tool(tool: &str) -> Option<String> {
    |    ^^^^^^^^^^^^^^^^^^^

warning: function `wsl_distro_from_path` is never used
   --> src\commands\misc.rs:689:4
    |
689 | fn wsl_distro_from_path(path: &Path) -> Option<String> {
    |    ^^^^^^^^^^^^^^^^^^^^

warning: struct `UpdateInfo` is never constructed
  --> src\services\app_updater.rs:50:12
   |
50 | pub struct UpdateInfo {
   |            ^^^^^^^^^^

warning: method `get` is never used
  --> src\services\builtin_repos.rs:21:12
   |
19 | impl LocalizedDescription {
   | ------------------------- method in this implementation
20 |     /// 根据语言代码获取描述
21 |     pub fn get(&self, lang: &str) -> &str {
   |            ^^^

warning: struct `RepoWithMeta` is never constructed
  --> src\services\builtin_repos.rs:49:12
   |
49 | pub struct RepoWithMeta {
   |            ^^^^^^^^^^^^

warning: struct `RestoreResult` is never constructed
  --> src\services\builtin_repos.rs:66:12
   |
66 | pub struct RestoreResult {
   |            ^^^^^^^^^^^^^

warning: function `is_builtin_skill_repo` is never used
   --> src\services\builtin_repos.rs:158:8
    |
158 | pub fn is_builtin_skill_repo(owner: &str, name: &str) -> Result<bool, AppError> {
    |        ^^^^^^^^^^^^^^^^^^^^^

warning: function `is_builtin_command_repo` is never used
   --> src\services\builtin_repos.rs:166:8
    |
166 | pub fn is_builtin_command_repo(owner: &str, name: &str) -> Result<bool, AppError> {
    |        ^^^^^^^^^^^^^^^^^^^^^^^

warning: function `builtin_skill_repos_map` is never used
   --> src\services\builtin_repos.rs:174:8
    |
174 | pub fn builtin_skill_repos_map() -> Result<HashMap<(String, String), BuiltinRepoConfig>, AppError> {
    |        ^^^^^^^^^^^^^^^^^^^^^^^

warning: function `builtin_command_repos_map` is never used
   --> src\services\builtin_repos.rs:184:8
    |
184 | pub fn builtin_command_repos_map() -> Result<HashMap<(String, String), BuiltinRepoConfig>, AppError>
    |        ^^^^^^^^^^^^^^^^^^^^^^^^^

warning: struct `BatchUpdateCheckResult` is never constructed
  --> src\services\github_api.rs:64:12
   |
64 | pub struct BatchUpdateCheckResult {
   |            ^^^^^^^^^^^^^^^^^^^^^^

warning: associated functions `is_project_valid`, `ensure_project_claude_dir`, and `get_project_resource_dir` are never used
   --> src\services\project.rs:171:12
    |
 37 | impl ProjectService {
    | ------------------- associated functions in this implementation
...
171 |     pub fn is_project_valid(path: &Path) -> bool {
    |            ^^^^^^^^^^^^^^^^
...
178 |     pub fn ensure_project_claude_dir(project_path: &Path) -> Result<PathBuf> {
    |            ^^^^^^^^^^^^^^^^^^^^^^^^^
...
192 |     pub fn get_project_resource_dir(project_path: &Path, resource_type: &str) -> Result<PathBuf> {
    |            ^^^^^^^^^^^^^^^^^^^^^^^^

warning: associated function `extract_doc_path_from_url` is never used        
   --> src\services\skill.rs:373:8
    |
362 | impl SkillService {
    | ----------------- associated function in this implementation
...
373 |     fn extract_doc_path_from_url(url: &str) -> Option<String> {
    |        ^^^^^^^^^^^^^^^^^^^^^^^^^

warning: struct `UpdateCheckProgress` is never constructed
  --> src\services\update.rs:44:12
   |
44 | pub struct UpdateCheckProgress {
   |            ^^^^^^^^^^^^^^^^^^^

warning: `cc-switch` (lib) generated 43 warnings (run `cargo fix --lib -p cc-switch` to apply 4 suggestions)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.72s       
     Running `target\debug\cc-switch.exe`
[2026-03-18][13:37:50][INFO][cc_switch_lib] === Single Instance Callback Triggered ===
[2026-03-18][13:37:50][INFO][cc_switch_lib] ℹ No deep link URL found in args (this is expected on macOS when launched via system)