//! Implements support for handling the users settings

mod client;
mod http_client;
pub mod proxies;
pub mod model;
mod settings;
mod store;

pub use client::{FirstUser, UsersClient};
pub use http_client::UsersHttpClient;
pub use settings::{FirstUserSettings, RootUserSettings, UserSettings};
pub use store::UsersStore;
