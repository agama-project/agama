//! Code to handle the network configuration
//!
//! It includes the data model (based on nmstate) and a D-Bus service.

pub mod dbus;
pub mod state;

pub use dbus::NetworkService;
pub use state::{NetworkState, NetworkStateError};
