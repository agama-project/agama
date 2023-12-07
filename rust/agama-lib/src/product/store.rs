//! Implements the store for the storage settings.

use super::{ProductClient, ProductSettings};
use crate::error::ServiceError;
use crate::manager::ManagerClient;
use zbus::Connection;

/// Loads and stores the software settings from/to the D-Bus service.
pub struct ProductStore<'a> {
    product_client: ProductClient<'a>,
    manager_client: ManagerClient<'a>,
}

impl<'a> ProductStore<'a> {
    pub async fn new(connection: Connection) -> Result<ProductStore<'a>, ServiceError> {
        Ok(Self {
            product_client: ProductClient::new(connection.clone()).await?,
            manager_client: ManagerClient::new(connection).await?,
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
            let email = settings.registration_email.clone().unwrap_or_default();
            self.product_client.register(reg_code, &email).await?;
            probe = true;
        }

        if probe {
            self.manager_client.probe().await?;
        }

        Ok(())
    }
}
