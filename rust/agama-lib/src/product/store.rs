//! Implements the store for the product settings.
use super::{ProductHTTPClient, ProductSettings};
use crate::error::ServiceError;
use crate::manager::http_client::ManagerHTTPClient;

/// Loads and stores the product settings from/to the D-Bus service.
pub struct ProductStore {
    product_client: ProductHTTPClient,
    manager_client: ManagerHTTPClient,
}

impl ProductStore {
    pub fn new() -> Result<ProductStore, ServiceError> {
        Ok(Self {
            product_client: ProductHTTPClient::new()?,
            manager_client: ManagerHTTPClient::new()?,
        })
    }

    fn non_empty_string(s: String) -> Option<String> {
        if s.is_empty() {
            None
        } else {
            Some(s)
        }
    }

    pub async fn load(&self) -> Result<ProductSettings, ServiceError> {
        let product = self.product_client.product().await?;
        let registration_code = self.product_client.registration_code().await?;
        let email = self.product_client.email().await?;

        Ok(ProductSettings {
            id: Some(product),
            registration_code: Self::non_empty_string(registration_code),
            registration_email: Self::non_empty_string(email),
        })
    }

    pub async fn store(&self, settings: &ProductSettings) -> Result<(), ServiceError> {
        let mut probe = false;
        if let Some(product) = &settings.id {
            let existing_product = self.product_client.product().await?;
            if *product != existing_product {
                // avoid selecting same product and unnecessary probe
                self.product_client.select_product(product).await?;
                probe = true;
            }
        }
        if let Some(reg_code) = &settings.registration_code {
            let (result, message);
            if let Some(email) = &settings.registration_email {
                (result, message) = self.product_client.register(reg_code, email).await?;
            } else {
                (result, message) = self.product_client.register(reg_code, "").await?;
            }
            // FIXME: name the magic numbers. 3 is Registration not required
            // FIXME: well don't register when not required (no regcode in profile)
            if result != 0 && result != 3 {
                return Err(ServiceError::FailedRegistration(message));
            }
            probe = true;
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
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn product_store(mock_server_url: String) -> ProductStore {
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        let p_client = ProductHTTPClient::new_with_base(bhc.clone());
        let m_client = ManagerHTTPClient::new_with_base(bhc);
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
                    "requirement": "NotRequired"
                }"#,
                );
        });
        let url = server.url("/api");

        let store = product_store(url);
        let settings = store.load().await?;

        let expected = ProductSettings {
            id: Some("Tumbleweed".to_owned()),
            registration_code: None,
            registration_email: None,
        };
        // main assertion
        assert_eq!(settings, expected);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        software_mock.assert();
        registration_mock.assert_hits(2);
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
                    "product": ""
                }"#,
                );
        });
        let software_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/software/config")
                .header("content-type", "application/json")
                .body(r#"{"patterns":null,"product":"Tumbleweed"}"#);
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
