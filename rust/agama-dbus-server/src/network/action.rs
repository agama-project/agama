use crate::network::model::Connection;
use agama_lib::network::types::DeviceType;

/// Networking actions, like adding, updating or removing connections.
///
/// These actions are meant to be processed by [crate::network::system::NetworkSystem], updating the model
/// and the D-Bus tree as needed.
#[derive(Debug)]
pub enum Action {
    /// Add a new connection with the given name and type.
    AddConnection(String, DeviceType),
    /// Update a connection (replacing the old one).
    UpdateConnection(Connection),
    /// Update a controller connection (replacing the old one).
    UpdateControllerConnection(Connection, Vec<String>),
    /// Remove the connection with the given Uuid.
    RemoveConnection(String),
    /// Apply the current configuration.
    Apply,
}
