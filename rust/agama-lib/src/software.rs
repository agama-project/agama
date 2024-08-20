//! Implements support for handling the software settings

mod client;
pub mod model;
pub mod proxies;
mod settings;
mod store;

pub use client::{Pattern, SelectedBy, SoftwareClient, UnknownSelectedBy};
pub use settings::SoftwareSettings;
pub use store::SoftwareStore;
