//! Implements the store for the storage settings.

use super::StorageSettings;
use crate::error::ServiceError;
use crate::storage::http_client::StorageHTTPClient;

/// Loads and stores the storage settings from/to the HTTP service.
pub struct StorageStore {
    storage_client: StorageHTTPClient,
}

impl StorageStore {
    pub fn new() -> Result<StorageStore, ServiceError> {
        Ok(Self {
            storage_client: StorageHTTPClient::new()?,
        })
    }

    pub async fn load(&self) -> Result<StorageSettings, ServiceError> {
        Ok(self.storage_client.get_config().await?)
    }

    pub async fn store(&self, settings: StorageSettings) -> Result<(), ServiceError> {
        self.storage_client.set_config(&settings).await?;
        Ok(())
    }
}
