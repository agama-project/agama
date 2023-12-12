use crate::network::model::Connection;
use agama_lib::network::types::DeviceType;
use tokio::sync::oneshot;
use uuid::Uuid;

use super::error::NetworkStateError;

pub type Responder<T> = oneshot::Sender<T>;
pub type ControllerConnection = (Connection, Vec<String>);

/// Networking actions, like adding, updating or removing connections.
///
/// These actions are meant to be processed by [crate::network::system::NetworkSystem], updating the model
/// and the D-Bus tree as needed.
#[derive(Debug)]
pub enum Action {
    /// Add a new connection with the given name and type.
    AddConnection(String, DeviceType),
    /// Gets a connection
    GetConnection(Uuid, Responder<Option<Connection>>),
    /// Gets a controller connection
    GetController(
        Uuid,
        Responder<Result<ControllerConnection, NetworkStateError>>,
    ),
    /// Sets a controller ports
    SetPorts(Uuid, Vec<String>, Responder<Result<(), NetworkStateError>>),
    /// Update a connection (replacing the old one).
    UpdateConnection(Connection),
    /// Remove the connection with the given Uuid.
    RemoveConnection(String),
    /// Apply the current configuration.
    Apply,
}
