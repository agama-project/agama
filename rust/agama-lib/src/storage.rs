//! Implements support for handling the storage settings

pub mod client;
pub mod model;
pub mod proxies;
mod settings;
mod store;

pub use client::{
    iscsi::{ISCSIClient, ISCSINode},
    StorageClient,
};
pub use settings::StorageSettings;
pub use store::StorageStore;
