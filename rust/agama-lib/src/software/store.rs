//! Implements the store for the storage settings.

use super::{SoftwareClient, SoftwareSettings};
use crate::error::ServiceError;
use crate::manager::ManagerClient;
use zbus::Connection;

/// Loads and stores the software settings from/to the D-Bus service.
pub struct SoftwareStore<'a> {
    software_client: SoftwareClient<'a>,
    manager_client: ManagerClient<'a>,
}

impl<'a> SoftwareStore<'a> {
    pub async fn new(connection: Connection) -> Result<SoftwareStore<'a>, ServiceError> {
        Ok(Self {
            software_client: SoftwareClient::new(connection.clone()).await?,
            manager_client: ManagerClient::new(connection).await?,
        })
    }

    pub async fn load(&self) -> Result<SoftwareSettings, ServiceError> {
        let product = self.software_client.product().await?;

        Ok(SoftwareSettings {
            product: Some(product),
        })
    }

    pub async fn store(&self, settings: &SoftwareSettings) -> Result<(), ServiceError> {
        if let Some(product) = &settings.product {
            let products = self.software_client.products().await?;
            let ids: Vec<String> = products.into_iter().map(|p| p.id).collect();
            if ids.contains(product) {
                self.software_client.select_product(product).await?;
                self.manager_client.probe().await?;
            } else {
                return Err(ServiceError::UnknownProduct(product.clone(), ids));
            }
        }
        Ok(())
    }
}
