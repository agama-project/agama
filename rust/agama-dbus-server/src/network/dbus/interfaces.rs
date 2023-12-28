//! Network D-Bus interfaces.
//!
//! This module contains the set of D-Bus interfaces that are exposed by [D-Bus network
//! service](crate::NetworkService).

mod common;
mod connection_configs;
mod connections;
mod devices;
mod ip_config;
pub use connection_configs::{Bond, Wireless};
pub use connections::{Connection, Connections, Match};
pub use devices::{Device, Devices};
pub use ip_config::Ip;
