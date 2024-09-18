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

    pub async fn store(&self, settings: &StorageSettings) -> Result<(), ServiceError> {
        self.storage_client.set_config(settings).await?;
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn storage_store(mock_server_url: String) -> StorageStore {
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        let client = StorageHTTPClient::new_with_base(bhc);
        StorageStore {
            storage_client: client,
        }
    }

    #[test]
    async fn test_getting_storage() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let storage_mock = server.mock(|when, then| {
            when.method(GET).path("/api/storage/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "storage": { "some": "stuff" }
                }"#,
                );
        });
        let url = server.url("/api");

        let store = storage_store(url);
        let settings = store.load().await?;

        // main assertion
        assert_eq!(settings.storage.unwrap().get(), r#"{ "some": "stuff" }"#);
        assert!(settings.storage_autoyast.is_none());

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        storage_mock.assert();
        Ok(())
    }

    #[test]
    async fn test_setting_storage_ok() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let storage_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/storage/config")
                .header("content-type", "application/json")
                .body(r#"{"legacyAutoyastStorage":{ "some" : "data" }}"#);
            then.status(200);
        });
        let url = server.url("/api");

        let store = storage_store(url);
        let boxed_raw_value =
            serde_json::value::RawValue::from_string(r#"{ "some" : "data" }"#.to_owned())?;
        let settings = StorageSettings {
            storage: None,
            storage_autoyast: Some(boxed_raw_value),
        };

        let result = store.store(&settings).await;

        // main assertion
        result?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        storage_mock.assert();
        Ok(())
    }
}
