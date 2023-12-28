//! D-Bus service and interfaces.
//!
//! This module contains a [D-Bus network service](NetworkService) which expose the network
//! configuration for Agama.

mod interfaces;
pub mod service;
mod tree;

pub use service::NetworkService;
pub(crate) use tree::Tree;
