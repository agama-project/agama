//! Implements support for handling the localization settings

mod http_client;
pub mod model;
mod proxies;
mod settings;
mod store;

pub use http_client::LocalizationHTTPClient;
pub use proxies::LocaleProxy;
pub use settings::LocalizationSettings;
pub use store::LocalizationStore;
