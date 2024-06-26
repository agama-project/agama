//! Implements the store for the storage settings.

use super::{StorageClient, StorageSettings};
use crate::error::ServiceError;
use zbus::Connection;

/// Loads and stores the storage settings from/to the D-Bus service.
pub struct StorageStore<'a> {
    storage_client: StorageClient<'a>,
}

impl<'a> StorageStore<'a> {
    pub async fn new(connection: Connection) -> Result<StorageStore<'a>, ServiceError> {
        Ok(Self {
            storage_client: StorageClient::new(connection).await?,
        })
    }

    pub async fn load(&self) -> Result<StorageSettings, ServiceError> {
        Ok(self.storage_client.get_config().await?)
    }

    pub async fn store(&self, settings: StorageSettings) -> Result<(), ServiceError> {
        self.storage_client.set_config(settings).await?;
        Ok(())
    }
}
