//! Implements the store for the storage settings.

use std::collections::HashMap;

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
