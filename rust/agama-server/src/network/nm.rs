//! Support for interacting with [NetworkManager](https://networkmanager.dev/).
//!
//! This module defines [a NetworkManager client](client::NetworkManagerClient) and a set of
//! structs and enums to work with NetworkManager configuration. It is intended to be used
//! internally, so the API is focused on Agama's use cases.

mod adapter;
mod client;
mod dbus;
mod error;
mod model;
mod proxies;
mod watcher;

pub use adapter::NetworkManagerAdapter;
pub use client::NetworkManagerClient;
pub use watcher::NetworkManagerWatcher;
