//! Implements support for handling the product settings

mod client;
pub mod proxies;
mod settings;
mod store;

pub use crate::software::model::RegistrationRequirement;
pub use client::{Product, ProductClient};
pub use settings::ProductSettings;
pub use store::ProductStore;
