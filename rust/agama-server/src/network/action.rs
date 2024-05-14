use crate::network::model::{AccessPoint, Connection, Device};
use agama_lib::network::types::DeviceType;
use tokio::sync::oneshot;
use uuid::Uuid;

use super::{error::NetworkStateError, model::GeneralState, NetworkAdapterError};

pub type Responder<T> = oneshot::Sender<T>;
pub type ControllerConnection = (Connection, Vec<String>);

/// Networking actions, like adding, updating or removing connections.
///
/// These actions are meant to be processed by [crate::network::system::NetworkSystem], updating the model
/// and the D-Bus tree as needed.
#[derive(Debug)]
pub enum Action {
    /// Add a new connection with the given name and type.
    AddConnection(String, DeviceType, Responder<Result<(), NetworkStateError>>),
    /// Add a new connection
    NewConnection(Box<Connection>, Responder<Result<(), NetworkStateError>>),
    /// Gets a connection by its id
    GetConnection(String, Responder<Option<Connection>>),
    /// Gets a connection by its Uuid
    GetConnectionByUuid(Uuid, Responder<Option<Connection>>),
    /// Gets a connection
    GetConnections(Responder<Vec<Connection>>),
    /// Gets a controller connection
    GetController(
        Uuid,
        Responder<Result<ControllerConnection, NetworkStateError>>,
    ),
    /// Gets all scanned access points
    GetAccessPoints(Responder<Vec<AccessPoint>>),
    /// Adds a new device.
    AddDevice(Box<Device>),
    /// Updates a device by its `name`.
    UpdateDevice(String, Box<Device>),
    /// Removes a device by its `name`.
    RemoveDevice(String),
    /// Gets a device by its name
    GetDevice(String, Responder<Option<Device>>),
    /// Gets all the existent devices
    GetDevices(Responder<Vec<Device>>),
    GetGeneralState(Responder<GeneralState>),
    /// Sets a controller's ports. It uses the Uuid of the controller and the IDs or interface names
    /// of the ports.
    SetPorts(
        Uuid,
        Box<Vec<String>>,
        Responder<Result<(), NetworkStateError>>,
    ),
    /// Updates a connection (replacing the old one).
    UpdateConnection(Box<Connection>, Responder<Result<(), NetworkStateError>>),
    /// Updates the general network configuration
    UpdateGeneralState(GeneralState),
    /// Forces a wireless networks scan refresh
    RefreshScan(Responder<Result<(), NetworkAdapterError>>),
    /// Remove the connection with the given Uuid.
    RemoveConnection(String, Responder<Result<(), NetworkStateError>>),
    /// Apply the current configuration.
    Apply(Responder<Result<(), NetworkAdapterError>>),
}
