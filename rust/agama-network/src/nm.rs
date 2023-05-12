//! Support for interacting with [NetworkManager](https://networkmanager.dev/).
//!
//! This module defines [a NetworkManager client](client::NetworkManagerClient) and a set of
//! structs and enums to work with NetworkManager configuration. It is intended to be used
//! internally, so the API is focused on Agama's use cases.

mod client;
mod dbus;
mod model;
mod proxies;

pub use client::NetworkManagerClient;
