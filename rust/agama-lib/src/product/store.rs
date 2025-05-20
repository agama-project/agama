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

//! Implements the store for the product settings.
use super::{http_client::ProductHTTPClientError, ProductHTTPClient, ProductSettings};
use crate::{
    http::BaseHTTPClient,
    manager::http_client::{ManagerHTTPClient, ManagerHTTPClientError},
};

#[derive(Debug, thiserror::Error)]
pub enum ProductStoreError {
    #[error("Error processing product settings: {0}")]
    Product(#[from] ProductHTTPClientError),
    #[error("Error reading software repositories: {0}")]
    Probe(#[from] ManagerHTTPClientError),
}

type ProductStoreResult<T> = Result<T, ProductStoreError>;

/// Loads and stores the product settings from/to the D-Bus service.
pub struct ProductStore {
    product_client: ProductHTTPClient,
    manager_client: ManagerHTTPClient,
}

impl ProductStore {
    pub fn new(client: BaseHTTPClient) -> ProductStore {
        Self {
            product_client: ProductHTTPClient::new(client.clone()),
            manager_client: ManagerHTTPClient::new(client),
        }
    }

    fn non_empty_string(s: String) -> Option<String> {
        if s.is_empty() {
            None
        } else {
            Some(s)
        }
    }

    pub async fn load(&self) -> ProductStoreResult<ProductSettings> {
        let product = self.product_client.product().await?;
        let registration_info = self.product_client.get_registration().await?;
        let registered_addons = self.product_client.get_registered_addons().await?;

        let addons = if registered_addons.is_empty() {
            None
        } else {
            Some(registered_addons)
        };
        Ok(ProductSettings {
            id: Some(product),
            registration_code: Self::non_empty_string(registration_info.key),
            registration_email: Self::non_empty_string(registration_info.email),
            registration_url: Self::non_empty_string(registration_info.url),
            addons,
        })
    }

    pub async fn store(&self, settings: &ProductSettings) -> ProductStoreResult<()> {
        let mut probe = false;
        if let Some(product) = &settings.id {
            let existing_product = self.product_client.product().await?;
            if *product != existing_product {
                // avoid selecting same product and unnecessary probe
                self.product_client.select_product(product).await?;
                probe = true;
            }
        }
        if let Some(url) = &settings.registration_url {
            self.product_client.set_registration_url(url).await?;
        }
        if let Some(reg_code) = &settings.registration_code {
            let email = settings.registration_email.as_deref().unwrap_or("");

            self.product_client.register(reg_code, email).await?;
            // TODO: avoid reprobing if the system has been already registered with the same code?
            probe = true;
        }
        // register the addons in the order specified in the profile
        if let Some(addons) = &settings.addons {
            for addon in addons.iter() {
                self.product_client.register_addon(addon).await?;
            }
        }

        if probe {
            self.manager_client.probe().await?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::http::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn product_store(mock_server_url: String) -> ProductStore {
        let bhc = BaseHTTPClient::new(mock_server_url).unwrap();
        let p_client = ProductHTTPClient::new(bhc.clone());
        let m_client = ManagerHTTPClient::new(bhc);
        ProductStore {
            product_client: p_client,
            manager_client: m_client,
        }
    }

    #[test]
    async fn test_getting_product() -> Result<(), Box<dyn Error>> {
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
        let registration_mock = server.mock(|when, then| {
            when.method(GET).path("/api/software/registration");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "key": "",
                    "email": "",
                    "url": ""
                }"#,
                );
        });
        let addons_mock = server.mock(|when, then| {
            when.method(GET)
                .path("/api/software/registration/addons/registered");
            then.status(200)
                .header("content-type", "application/json")
                .body("[]");
        });
        let url = server.url("/api");

        let store = product_store(url);
        let settings = store.load().await?;

        let expected = ProductSettings {
            id: Some("Tumbleweed".to_owned()),
            registration_code: None,
            registration_email: None,
            registration_url: None,
            addons: None,
        };
        // main assertion
        assert_eq!(settings, expected);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        registration_mock.assert();
        addons_mock.assert();
        Ok(())
    }

    #[test]
    async fn test_setting_product_ok() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        // no product selected at first
        let get_software_mock = server.mock(|when, then| {
            when.method(GET).path("/api/software/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "patterns": {},
                    "packages": [],
                    "product": ""
                }"#,
                );
        });
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":null,"packages":null,"product":"Tumbleweed"}"#);
            then.status(200);
        });
        let manager_mock = server.mock(|when, then| {
            when.method(POST)
                .path("/api/manager/probe_sync")
                .header("content-type", "application/json")
                .body("null");
            then.status(200);
        });
        let url = server.url("/api");

        let store = product_store(url);
        let settings = ProductSettings {
            id: Some("Tumbleweed".to_owned()),
            registration_code: None,
            registration_email: None,
            registration_url: None,
            addons: None,
        };

        let result = store.store(&settings).await;

        // main assertion
        result?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        get_software_mock.assert();
        software_mock.assert();
        manager_mock.assert();
        Ok(())
    }
}
