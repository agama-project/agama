//! Implements the store for the storage settings.

use super::{StorageClient, StorageSettings};
use crate::error::ServiceError;
use std::default::Default;
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

    // TODO: read the settings from the service
    pub async fn load(&self) -> Result<StorageSettings, ServiceError> {
        Ok(Default::default())
    }

    pub async fn store(&self, settings: &StorageSettings) -> Result<(), ServiceError> {
        self.storage_client
            .calculate(
                settings.devices.iter().map(|d| d.name.clone()).collect(),
                settings.encryption_password.clone().unwrap_or_default(),
                settings.lvm.unwrap_or_default(),
            )
            .await?;
        Ok(())
    }
}
