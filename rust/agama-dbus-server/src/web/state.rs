//! Implements the web service state.

use super::config::ServiceConfig;

/// Web service state.
///
/// It holds the service configuration and the current D-Bus connection.
#[derive(Clone)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub dbus_connection: zbus::Connection,
}
