//! Implements the store for the storage settings.

use super::{SoftwareClient, SoftwareSettings};
use crate::error::ServiceError;
use zbus::Connection;

/// Loads and stores the software settings from/to the D-Bus service.
pub struct SoftwareStore<'a> {
    software_client: SoftwareClient<'a>,
}

impl<'a> SoftwareStore<'a> {
    pub async fn new(connection: Connection) -> Result<SoftwareStore<'a>, ServiceError> {
        Ok(Self {
            software_client: SoftwareClient::new(connection.clone()).await?,
        })
    }

    pub async fn load(&self) -> Result<SoftwareSettings, ServiceError> {
        // TODO: real selected patterns
        Ok(SoftwareSettings {
            patterns: vec![],
        })
    }

    pub async fn store(&self, settings: &SoftwareSettings) -> Result<(), ServiceError> {
        // TODO: handle selected patterns
        //if let Some(product) = &settings.product {
        //    self.software_client.select_product(product).await?;
        //    self.manager_client.probe().await?;
        //}

        Ok(())
    }
}
