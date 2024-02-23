//! Implements the web service state.

use super::{config::ServiceConfig, EventsSender};

/// Web service state.
///
/// It holds the service configuration, the current D-Bus connection and a channel to send events.
#[derive(Clone)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub dbus_connection: zbus::Connection,
    pub events: EventsSender,
}
