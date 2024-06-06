//! Implements support for handling the storage settings

mod autoyast;
pub mod client;
pub mod model;
pub mod proxies;
mod settings;
mod store;

pub use autoyast::store::StorageAutoyastStore;
pub use client::{
    iscsi::{ISCSIAuth, ISCSIClient, ISCSIInitiator, ISCSINode},
    StorageClient,
};
pub use settings::StorageSettings;
pub use store::StorageStore;
