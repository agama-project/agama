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
//! `/org/opensuse/Agama1/Network/devices/[0-9]+`. At this point, those objects expose a bit of
//! information about network devices. The entry point for the devices is the
//! `/org/opensuse/Agama1/Network/devices` object, that expose a `GetDevices` method that returns
//! the paths for the devices objects.
//!
//! The network configuration is exposed through the connections objects as
//! `/org/opensuse/Agama1/Network/connections/[0-9]+`. Those objects are composed of several
//! D-Bus interfaces depending on its type:
//!
//! * `org.opensuse.Agama1.Network.Connection` exposes common information across all connection
//! types.
//! * `org.opensuse.Agama1.Network.Connection.IPv4` includes IPv4 settings, like the configuration method
//! (DHCP, manual, etc.), IP addresses, name servers and so on.
//! * `org.opensuse.Agama1.Network.Connection.Wireless` exposes the configuration for wireless
//! connections.
//!
//! Analogous to the devices API, there is a special `/org/opensuse/Agama1/Network/connections`
//! object that implements a few methods that are related to the collection of connections like
//! `GetConnections`, `AddConnection` and `RemoveConnection`. Additionally, it implements an
//! `Apply` method to write the changes to the NetworkManager service.
//!
//! ## Limitations
//!
//! We expect to address the following problems as we evolve the API, but it is noteworthy to have
//! them in mind:
//!
//! * The devices list does not reflect the changes in the system. For instance, it is not updated
//! when a device is connected to the system.
//! * Many configuration types are still missing (bridges, bonding, etc.).

mod action;
mod adapter;
pub mod dbus;
pub mod error;
pub mod model;
mod nm;
pub mod system;

pub use action::Action;
pub use adapter::Adapter;
pub use dbus::NetworkService;
pub use model::NetworkState;
pub use nm::NetworkManagerAdapter;
pub use system::NetworkSystem;
use zbus::Connection;

pub async fn export_dbus_objects(
    connection: &Connection,
) -> Result<(), Box<dyn std::error::Error>> {
    let adapter = NetworkManagerAdapter::from_system()
        .await
        .expect("Could not connect to NetworkManager to read the configuration.");
    NetworkService::start(connection, adapter).await
}
