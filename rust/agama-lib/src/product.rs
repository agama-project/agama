//! Implements support for handling the product settings

mod client;
mod proxies;
mod settings;
mod store;

pub use client::{Product, ProductClient, RegistrationRequirement};
pub use settings::ProductSettings;
pub use store::ProductStore;
