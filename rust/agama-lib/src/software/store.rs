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

//! Implements the store for the software settings.

use std::collections::HashMap;

use super::{
    http_client::SoftwareHTTPClientError, model::SoftwareConfig, SoftwareHTTPClient,
    SoftwareSettings,
};
use crate::base_http_client::BaseHTTPClient;

#[derive(Debug, thiserror::Error)]
#[error("Error processing software settings: {0}")]
pub struct SoftwareStoreError(#[from] SoftwareHTTPClientError);

/// Loads and stores the software settings from/to the D-Bus service.
pub struct SoftwareStore {
    software_client: SoftwareHTTPClient,
}

impl SoftwareStore {
    pub fn new(client: BaseHTTPClient) -> Result<SoftwareStore, SoftwareStoreError> {
        Ok(Self {
            software_client: SoftwareHTTPClient::new(client),
        })
    }

    pub async fn load(&self) -> Result<SoftwareSettings, SoftwareStoreError> {
        let patterns = self.software_client.user_selected_patterns().await?;
        // FIXME: user_selected_patterns is calling get_config too.
        let config = self.software_client.get_config().await?;
        Ok(SoftwareSettings {
            patterns: if patterns.is_empty() {
                None
            } else {
                Some(patterns)
            },
            packages: config.packages,
        })
    }

    pub async fn store(&self, settings: &SoftwareSettings) -> Result<(), SoftwareStoreError> {
        let patterns: Option<HashMap<String, bool>> = settings
            .patterns
            .clone()
            .map(|pat| pat.iter().map(|n| (n.to_owned(), true)).collect());

        let config = SoftwareConfig {
            // do not change the product
            product: None,
            patterns,
            packages: settings.packages.clone(),
        };
        self.software_client.set_config(&config).await?;

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

    fn software_store(mock_server_url: String) -> SoftwareStore {
        let bhc = BaseHTTPClient::new(mock_server_url).unwrap();
        let client = SoftwareHTTPClient::new(bhc);
        SoftwareStore {
            software_client: client,
        }
    }

    #[test]
    async fn test_getting_software() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(GET).path("/api/software/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "patterns": {"xfce":true},
                    "packages": ["vim"],
                    "product": "Tumbleweed"
                }"#,
                );
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = store.load().await?;

        let expected = SoftwareSettings {
            patterns: Some(vec!["xfce".to_owned()]),
            packages: Some(vec!["vim".to_owned()]),
        };
        // main assertion
        assert_eq!(settings, expected);

        // FIXME: at this point it is calling the method twice
        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert_hits(2);
        Ok(())
    }

    #[test]
    async fn test_setting_software_ok() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":{"xfce":true},"packages":["vim"],"product":null}"#);
            then.status(200);
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = SoftwareSettings {
            patterns: Some(vec!["xfce".to_owned()]),
            packages: Some(vec!["vim".to_owned()]),
        };

        let result = store.store(&settings).await;

        // main assertion
        result?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }

    #[test]
    async fn test_setting_software_err() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":{"no_such_pattern":true},"packages":["vim"],"product":null}"#);
            then.status(400)
                .body(r#"'{"error":"Agama service error: Failed to find these patterns: [\"no_such_pattern\"]"}"#);
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = SoftwareSettings {
            patterns: Some(vec!["no_such_pattern".to_owned()]),
            packages: Some(vec!["vim".to_owned()]),
        };

        let result = store.store(&settings).await;

        // main assertion
        assert!(result.is_err());

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }
}
