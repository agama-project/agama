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

use super::{SoftwareHTTPClient, SoftwareSettings};
use crate::base_http_client::BaseHTTPClient;
use crate::error::ServiceError;

/// Loads and stores the software settings from/to the D-Bus service.
pub struct SoftwareStore {
    software_client: SoftwareHTTPClient,
}

impl SoftwareStore {
    pub fn new(client: BaseHTTPClient) -> Result<SoftwareStore, ServiceError> {
        Ok(Self {
            software_client: SoftwareHTTPClient::new_with_base(client),
        })
    }

    pub async fn load(&self) -> Result<SoftwareSettings, ServiceError> {
        let patterns = self.software_client.user_selected_patterns().await?;
        Ok(SoftwareSettings { patterns })
    }

    pub async fn store(&self, settings: &SoftwareSettings) -> Result<(), ServiceError> {
        let patterns: HashMap<String, bool> = settings
            .patterns
            .iter()
            .map(|name| (name.to_owned(), true))
            .collect();
        self.software_client.select_patterns(patterns).await?;

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
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        let client = SoftwareHTTPClient::new_with_base(bhc);
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
                    "product": "Tumbleweed"
                }"#,
                );
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = store.load().await?;

        let expected = SoftwareSettings {
            patterns: vec!["xfce".to_owned()],
        };
        // main assertion
        assert_eq!(settings, expected);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }

    #[test]
    async fn test_setting_software_ok() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":{"xfce":true},"product":null}"#);
            then.status(200);
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = SoftwareSettings {
            patterns: vec!["xfce".to_owned()],
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
                .body(r#"{"patterns":{"no_such_pattern":true},"product":null}"#);
            then.status(400)
                .body(r#"'{"error":"Agama service error: Failed to find these patterns: [\"no_such_pattern\"]"}"#);
        });
        let url = server.url("/api");

        let store = software_store(url);
        let settings = SoftwareSettings {
            patterns: vec!["no_such_pattern".to_owned()],
        };

        let result = store.store(&settings).await;

        // main assertion
        assert!(result.is_err());

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        Ok(())
    }
}
