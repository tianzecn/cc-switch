//! Data Access Object layer
//!
//! Database access operations for each domain

pub mod agents;
pub mod commands;
pub mod failover;
pub mod hooks;
pub mod mcp;
pub mod prompts;
pub mod providers;
pub mod proxy;
pub mod settings;
pub mod skills;
pub mod stream_check;
pub mod universal_providers;

// 所有 DAO 方法都通过 Database impl 提供，无需单独导出
// 导出特定类型供外部使用
pub use agents::AgentDiscoveryCache;
pub use commands::{CommandDiscoveryCache, CACHE_EXPIRY_SECONDS};
pub use failover::FailoverQueueItem;
pub use hooks::HookDiscoveryCache;
