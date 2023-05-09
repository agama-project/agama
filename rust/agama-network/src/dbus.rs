//! Network D-Bus service
//!
//! This module contains a [D-Bus network service](NetworkService) which expose the network
//! configuration for Agama.

mod interfaces;
pub mod service;

pub use service::NetworkService;
