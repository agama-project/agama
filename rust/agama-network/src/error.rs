use thiserror::Error;

#[derive(Error, Debug)]
pub enum NetworkStateError {
    #[error("Invalid key name: '{0}'")]
    UnknownDevice(String),
}

impl From<NetworkStateError> for zbus::fdo::Error {
    fn from(value: NetworkStateError) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("Network error: {}", value.to_string()))
    }
}
