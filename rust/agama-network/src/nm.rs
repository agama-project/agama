//! NetworkManager model.
//!
//! This module defines [a NetworkManager client](client::NetworkManagerClient) and a set of
//! structs and enums to work with NetworkManager configuration. It is intended to be used
//! internally, so the API is focused on Agama's use cases.

mod client;
mod model;
mod proxies;

pub use client::NetworkManagerClient;
pub use model::*;
