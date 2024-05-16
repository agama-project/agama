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
        // If it is not possible to get the settings (e.g., there are no settings yet), return
        // the default.
        let Ok(boot_device) = self.storage_client.boot_device().await else {
            return Ok(StorageSettings::default());
        };
        let lvm = self.storage_client.lvm().await?;
        let encryption_password = self.storage_client.encryption_password().await?;

        Ok(StorageSettings {
            boot_device,
            lvm,
            encryption_password,
        })
    }

    pub async fn store(&self, settings: &StorageSettings) -> Result<(), ServiceError> {
        self.storage_client.calculate(settings).await?;
        Ok(())
    }
}
