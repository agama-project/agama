//! Network configuration service for Agama
//!
//! This library implements the network configuration service for Agama.
//!
//! ## Connections and devices
//!
//! The library is built around the concepts of network devices and connections, akin to
//! NetworkManager approach.
//!
//! Each network device is exposed as a D-Bus object using a path like
//! `/org/opensuse/Agama/Network1/Devices/[0-9]+`. At this point, those objects expose a bit of
//! information about network devices. The entry point for the devices is the
//! `/org/opensuse/Agama/Network1/Devices` object, that expose a `GetDevices` method that returns
//! the paths for the devices objects.
//!
//! The network configuration is exposed through the connections objects as
//! `/org/opensuse/Agama/Network1/Connections/[0-9]+`. Those objects are composed of several
//! D-Bus interfaces depending on its type:
//!
//! * `org.opensuse.Agama.Network1.Connection` exposes common information across all connection
//! types.
//! * `org.opensuse.Agama.Network1.Connection.IPv4` includes IPv4 settings, like the configuration method
//! (DHCP, manual, etc.), IP addresses, name servers and so on.
//! * `org.opensuse.Agama.Network1.Connection.Wireless` exposes the configuration for wireless
//! connections.
//!
//! Analogous to the devices API, there is a special `/org/opensuse/Agama/Network1/Connections`
//! object that implements a `GetConnections` to get the list of paths for the connections objects.
//!
//! ## Limitations
//!
//! We expect to address the following problems as we evolve the API, but it is noteworthy to have
//! them in mind:
//!
//! * By now, this is just a read-only API.
//! * The devices list does not reflect the changes in the system. For instance, it is not updated
//! when a device is connected to the system.
//! * Many configuration types are still missing (bridges, bonding, etc.).
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
//!     .expect("Could not connect to the system D-Bus");
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
