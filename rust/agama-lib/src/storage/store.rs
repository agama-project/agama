// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! Implements the store for the storage settings.

use super::StorageSettings;
use crate::base_http_client::{BaseHTTPClient, BaseHTTPClientError};
use crate::storage::http_client::StorageHTTPClient;

/// Loads and stores the storage settings from/to the HTTP service.
pub struct StorageStore {
    storage_client: StorageHTTPClient,
}

impl StorageStore {
    pub fn new(client: BaseHTTPClient) -> Result<StorageStore, BaseHTTPClientError> {
        Ok(Self {
            storage_client: StorageHTTPClient::new(client),
        })
    }

    pub async fn load(&self) -> Result<StorageSettings, BaseHTTPClientError> {
        self.storage_client.get_config().await
    }

    pub async fn store(&self, settings: &StorageSettings) -> Result<(), BaseHTTPClientError> {
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
        let client = StorageHTTPClient::new(bhc);
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
