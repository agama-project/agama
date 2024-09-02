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

    pub async fn load(&self) -> Result<ProductSettings, ServiceError> {
        let product = self.product_client.product().await?;
        let registration_code = self.product_client.registration_code().await?;
        let email = self.product_client.email().await?;

        Ok(ProductSettings {
            id: Some(product),
            registration_code: Some(registration_code),
            registration_email: Some(email),
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
