//! Implements a client to access Agama's storage service.
use crate::base_http_client::BaseHTTPClient;
use crate::storage::StorageSettings;
use crate::ServiceError;

pub struct StorageHTTPClient {
    client: BaseHTTPClient,
}

impl StorageHTTPClient {
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    pub fn new_with_base(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<StorageSettings, ServiceError> {
        self.client.get("/storage/config").await
    }

    pub async fn set_config(&self, config: &StorageSettings) -> Result<(), ServiceError> {
        self.client.put_void("/storage/config", config).await
    }
}
