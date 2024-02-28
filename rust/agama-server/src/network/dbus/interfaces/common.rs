//! Traits to build network D-Bus interfaces.
//!
//! There are a set of operations that are shared by many D-Bus interfaces (retrieving or updating a connection, a configuration etc.).
//! The traits in this module implements the common pieces to make it easier to build new
//! interfaces and reduce code duplication.
//!
//! Note: it is not clear to us whether using traits or simple structs is better for this use case.
//! We could change the approach in the future.
use crate::network::{
    error::NetworkStateError,
    model::{Connection as NetworkConnection, ConnectionConfig},
    Action,
};
use async_trait::async_trait;
use tokio::sync::{mpsc::UnboundedSender, oneshot, MutexGuard};
use uuid::Uuid;

#[async_trait]
pub trait ConnectionInterface {
    fn uuid(&self) -> Uuid;

    async fn actions(&self) -> MutexGuard<UnboundedSender<Action>>;

    async fn get_connection(&self) -> Result<NetworkConnection, NetworkStateError> {
        let actions = self.actions().await;
        let (tx, rx) = oneshot::channel();
        actions
            .send(Action::GetConnection(self.uuid(), tx))
            .unwrap();
        rx.await
            .unwrap()
            .ok_or(NetworkStateError::UnknownConnection(
                self.uuid().to_string(),
            ))
    }

    /// Updates the connection data in the NetworkSystem.
    ///
    /// * `func`: function to update the connection.
    async fn update_connection<F>(&self, func: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut NetworkConnection) + std::marker::Send,
    {
        let mut connection = self.get_connection().await?;
        func(&mut connection);
        let actions = self.actions().await;
        actions
            .send(Action::UpdateConnection(Box::new(connection)))
            .unwrap();
        Ok(())
    }
}

#[async_trait]
pub trait ConnectionConfigInterface: ConnectionInterface {
    async fn get_config<T>(&self) -> Result<T, NetworkStateError>
    where
        T: TryFrom<ConnectionConfig, Error = NetworkStateError>,
    {
        let connection = self.get_connection().await?;
        connection.config.try_into()
    }

    async fn update_config<T, F>(&self, func: F) -> Result<(), NetworkStateError>
    where
        F: FnOnce(&mut T) + std::marker::Send,
        T: Into<ConnectionConfig>
            + TryFrom<ConnectionConfig, Error = NetworkStateError>
            + std::marker::Send,
    {
        let mut connection = self.get_connection().await?;
        let mut config: T = connection.config.clone().try_into()?;
        func(&mut config);
        connection.config = config.into();
        let actions = self.actions().await;
        actions
            .send(Action::UpdateConnection(Box::new(connection)))
            .unwrap();
        Ok(())
    }
}
