//! Network configuration service for Agama
//!
//! This library implements the network configuration service for Agama.
//!
//! ## Running the service
//!
//! Below there is an example to run the service on the system D-Bus.
//!
//! ```no_run
//! use agama_network::{NetworkState, NetworkService};
//! use zbus::Connection;
//! use async_std;
//!
//! #[async_std::main]
//! async fn main() {
//!   // Use the system D-Bus, although Agama use its own service
//!   let connection = zbus::Connection::system().await
//!     .expect("Could ont connect to the system D-Bus");
//!
//!   // Read the network state
//!   let network = NetworkState::from_system().await
//!     .expect("Could not read the network state");
//!
//!   // Build the service
//!   let mut service = NetworkService::new(network, connection);
//!
//!   // Start the service
//!   service.listen().await.expect("Could not start the service");
//! }
//! ```
pub mod dbus;
pub mod error;
pub mod model;
mod nm;

pub use dbus::NetworkService;
pub use model::NetworkState;
