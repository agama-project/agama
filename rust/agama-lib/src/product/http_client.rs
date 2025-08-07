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

use crate::http::{BaseHTTPClient, BaseHTTPClientError};
use crate::software::model::{
    AddonParams, RegistrationError, RegistrationInfo, RegistrationParams, SoftwareConfig,
};

use super::settings::AddonSettings;

#[derive(Debug, thiserror::Error)]
pub enum ProductHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
    // If present, the number is already printed in the String part
    #[error("Registration failed: {0}")]
    FailedRegistration(String, Option<u32>),
}

pub struct ProductHTTPClient {
    client: BaseHTTPClient,
}

impl ProductHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_software(&self) -> Result<SoftwareConfig, ProductHTTPClientError> {
        Ok(self.client.get("/software/config").await?)
    }

    pub async fn set_software(
        &self,
        config: &SoftwareConfig,
    ) -> Result<(), ProductHTTPClientError> {
        Ok(self.client.put_void("/software/config", config).await?)
    }

    /// Returns the id of the selected product to install
    pub async fn product(&self) -> Result<String, ProductHTTPClientError> {
        let config = self.get_software().await?;
        if let Some(product) = config.product {
            Ok(product)
        } else {
            Ok("".to_owned())
        }
    }

    /// Selects the product to install
    pub async fn select_product(&self, product_id: &str) -> Result<(), ProductHTTPClientError> {
        let config = SoftwareConfig {
            product: Some(product_id.to_owned()),
            patterns: None,
            packages: None,
            extra_repositories: None,
            only_required: None,
        };
        self.set_software(&config).await
    }

    pub async fn get_registration(&self) -> Result<RegistrationInfo, ProductHTTPClientError> {
        Ok(self.client.get("/software/registration").await?)
    }

    pub async fn set_registration_url(&self, url: &String) -> Result<(), ProductHTTPClientError> {
        self.client
            .put_void("/software/registration/url", url)
            .await?;
        Ok(())
    }

    // get list of registered addons
    pub async fn get_registered_addons(
        &self,
    ) -> Result<Vec<AddonSettings>, ProductHTTPClientError> {
        let addons = self
            .client
            .get("/software/registration/addons/registered")
            .await?;
        Ok(addons)
    }

    /// register product
    pub async fn register(&self, key: &str, email: &str) -> Result<(), ProductHTTPClientError> {
        // note RegistrationParams != RegistrationInfo, fun!
        let params = RegistrationParams {
            key: key.to_owned(),
            email: email.to_owned(),
        };
        let result = self
            .client
            .post_void("/software/registration", &params)
            .await;

        let Err(error) = result else {
            return Ok(());
        };

        let mut id: Option<u32> = None;

        let message = match error {
            BaseHTTPClientError::BackendError(_, details) => {
                let details: RegistrationError = serde_json::from_str(&details).unwrap();
                id = Some(details.id);
                format!("{} (error code: {})", details.message, details.id)
            }
            _ => format!("Could not register the product: #{error:?}"),
        };

        Err(ProductHTTPClientError::FailedRegistration(message, id))
    }

    /// register addon
    pub async fn register_addon(
        &self,
        addon: &AddonSettings,
    ) -> Result<(), ProductHTTPClientError> {
        let addon_params = AddonParams {
            id: addon.id.to_owned(),
            version: addon.version.to_owned(),
            registration_code: addon.registration_code.to_owned(),
        };
        let result = self
            .client
            .post_void("/software/registration/addons/register", &addon_params)
            .await;

        let Err(error) = result else {
            return Ok(());
        };

        let mut id: Option<u32> = None;

        let message = match error {
            BaseHTTPClientError::BackendError(_, details) => {
                println!("Details: {:?}", details);
                let details: RegistrationError = serde_json::from_str(&details).unwrap();
                id = Some(details.id);
                format!("{} (error code: {})", details.message, details.id)
            }
            _ => format!("Could not register the addon: #{error:?}"),
        };

        Err(ProductHTTPClientError::FailedRegistration(message, id))
    }
}
