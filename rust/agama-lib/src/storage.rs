//! Implements support for handling the storage settings

pub mod client;
pub mod device;
mod proxies;
mod settings;
mod store;

pub use client::StorageClient;
pub use settings::StorageSettings;
pub use store::StorageStore;
