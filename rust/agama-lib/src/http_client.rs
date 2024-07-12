use anyhow::Context;
use reqwest::{header, Client, Response};
use serde::de::DeserializeOwned;

use crate::{auth::AuthToken, error::ServiceError};

pub struct HTTPClient {
    client: Client,
    pub base_url: String,
}

const API_URL: &str = "http://localhost/api";

impl HTTPClient {
    // if there is need for client without authorization, create new constructor for it
    pub async fn new() -> Result<Self, ServiceError> {
        let token = AuthToken::find().context("You are not logged in")?;

        let mut headers = header::HeaderMap::new();
        let value = header::HeaderValue::from_str(format!("Bearer {}", token).as_str())
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        headers.insert(header::AUTHORIZATION, value);

        let client = Client::builder().default_headers(headers).build()?;

        Ok(Self {
            client,
            base_url: API_URL.to_string(), // TODO: add support for remote server
        })
    }

    const NO_TEXT: &'static str = "No text";
    // Simple wrapper around Response to get target type.
    // For more advanced usage use directly get method
    pub async fn get_type<T: DeserializeOwned>(&self, path: &str) -> Result<T, ServiceError> {
        let response = self.get(path).await?;
        if !response.status().is_success() {
            let code = response.status().as_u16();
            let text = response
                .text()
                .await
                .unwrap_or_else(|_| Self::NO_TEXT.to_string());
            return Err(ServiceError::BackendError(code, text));
        }

        response.json::<T>().await.map_err(|e| e.into())
    }

    pub async fn get(&self, path: &str) -> Result<Response, ServiceError> {
        self.client
            .get(self.target_path(path))
            .send()
            .await
            .map_err(|e| e.into())
    }

    fn target_path(&self, path: &str) -> String {
        self.base_url.clone() + path
    }
}
