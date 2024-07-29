//! Implements support for handling the localization settings

mod client;
pub mod model;
mod proxies;
mod settings;
mod store;

pub use client::LocalizationClient;
pub use proxies::LocaleProxy;
pub use settings::LocalizationSettings;
pub use store::LocalizationStore;
