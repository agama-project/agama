//! Implements the web service state.

use super::{config::ServiceConfig, EventsSender};
use std::path::PathBuf;

/// Web service state.
///
/// It holds the service configuration, the current D-Bus connection and a channel to send events.
#[derive(Clone)]
pub struct ServiceState {
    pub config: ServiceConfig,
    pub events: EventsSender,
    pub public_dir: PathBuf,
}
