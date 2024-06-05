//! Implements the store for the storage AutoYaST settings.

use crate::error::ServiceError;
use crate::storage::StorageClient;
use zbus::Connection;

/// Stores the storage AutoYaST settings to the D-Bus service.
///
/// NOTE: The AutoYaST settings are not loaded from D-Bus because they cannot be modified. The only
/// way of using the storage AutoYaST settings is by loading a JSON config file.
pub struct StorageAutoyastStore<'a> {
    storage_client: StorageClient<'a>,
}

impl<'a> StorageAutoyastStore<'a> {
    pub async fn new(connection: Connection) -> Result<StorageAutoyastStore<'a>, ServiceError> {
        Ok(Self {
            storage_client: StorageClient::new(connection).await?,
        })
    }

    pub async fn store(&self, settings: &str) -> Result<(), ServiceError> {
        self.storage_client.calculate_autoyast(settings).await?;
        Ok(())
    }
}
