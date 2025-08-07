// Copyright (c) [2024-2025] SUSE LLC
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
use std::time;
use tokio::time::sleep;

// registration retry attempts
const RETRY_ATTEMPTS: u32 = 4;
// initial delay for exponential backoff in seconds, it doubles after every retry (2,4,8,16)
const INITIAL_RETRY_DELAY: u64 = 2;

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
        let mut reprobe = false;
        if let Some(product) = &settings.id {
            let existing_product = self.product_client.product().await?;
            if *product != existing_product {
                // avoid selecting same product and unnecessary probe
                self.product_client.select_product(product).await?;
                probe = true;
            }
        }
        // register system if either URL or reg code is provided as RMT does not need reg code and SCC uses default url
        // bsc#1246069
        if settings.registration_code.is_some() || settings.registration_url.is_some() {
            if let Some(url) = &settings.registration_url {
                self.product_client.set_registration_url(url).await?;
            }
            // lets use empty string if not defined
            let reg_code = settings.registration_code.as_deref().unwrap_or("");
            let email = settings.registration_email.as_deref().unwrap_or("");

            self.retry_registration(|| self.product_client.register(reg_code, email))
                .await?;
            // TODO: avoid reprobing if the system has been already registered with the same code?
            reprobe = true;
        }

        // register the addons in the order specified in the profile
        if let Some(addons) = &settings.addons {
            for addon in addons.iter() {
                self.retry_registration(|| self.product_client.register_addon(addon))
                    .await?;
            }
        }

        if probe {
            self.manager_client.probe().await?;
        } else if reprobe {
            self.manager_client.reprobe().await?;
        }

        Ok(())
    }

    // shared retry logic for base product and addon registration
    async fn retry_registration<F>(&self, block: F) -> Result<(), ProductHTTPClientError>
    where
        F: AsyncFn() -> Result<(), ProductHTTPClientError>,
    {
        // retry counter
        let mut attempt = 0;
        loop {
            // call the passed block
            let result = block().await;

            match result {
                // success, leave the loop
                Ok(()) => return result,
                Err(ref error) => {
                    match error {
                        ProductHTTPClientError::FailedRegistration(_msg, code) => {
                            match code {
                                // see service/lib/agama/dbus/software/product.rb
                                // 4 => network error, 5 => timeout error
                                Some(4) | Some(5) => {
                                    if attempt >= RETRY_ATTEMPTS {
                                        // still failing, report the error
                                        return result;
                                    }

                                    // wait a bit then retry (run the loop again)
                                    let delay = INITIAL_RETRY_DELAY << attempt;
                                    eprintln!("Retrying registration in {} seconds...", delay);
                                    sleep(time::Duration::from_secs(delay)).await;
                                    attempt += 1;
                                }
                                // fail for other or unknown problems, retry very likely won't help
                                _ => return result,
                            }
                        }
                        // an HTTP error, fail
                        _ => return result,
                    }
                }
            }
        }
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
                    "registered": false,
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
                .body(r#"{"patterns":null,"packages":null,"product":"Tumbleweed","extraRepositories":null,"onlyRequired":null}"#);
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
