use crate::software::model::RegistrationInfo;
use crate::software::model::RegistrationParams;
use crate::software::model::SoftwareConfig;
use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

pub struct ProductHTTPClient {
    client: BaseHTTPClient,
}

impl ProductHTTPClient {
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    pub fn new_with_base(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_software(&self) -> Result<SoftwareConfig, ServiceError> {
        self.client.get("/software/config").await
    }

    pub async fn set_software(&self, config: &SoftwareConfig) -> Result<(), ServiceError> {
        self.client.put_void("/software/config", config).await
    }

    /// Returns the id of the selected product to install
    pub async fn product(&self) -> Result<String, ServiceError> {
        let config = self.get_software().await?;
        if let Some(product) = config.product {
            Ok(product)
        } else {
            Ok("".to_owned())
        }
    }

    /// Selects the product to install
    pub async fn select_product(&self, product_id: &str) -> Result<(), ServiceError> {
        let config = SoftwareConfig {
            product: Some(product_id.to_owned()),
            patterns: None,
        };
        self.set_software(&config).await
    }

    pub async fn get_registration(&self) -> Result<RegistrationInfo, ServiceError> {
        self.client.get("/software/registration").await
    }

    /// register product
    pub async fn register(&self, key: &str, email: &str) -> Result<(u32, String), ServiceError> {
        // note RegistrationParams != RegistrationInfo, fun!
        let params = RegistrationParams {
            key: key.to_owned(),
            email: email.to_owned(),
        };

        self.client.post("/software/registration", &params).await
    }
}
