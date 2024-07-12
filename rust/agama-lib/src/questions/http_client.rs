use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

use super::model;

pub struct HTTPClient {
    client: BaseHTTPClient,
}

impl HTTPClient {
    pub async fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    pub async fn list_questions(&self) -> Result<Vec<model::Question>, ServiceError> {
        self.client.get("/questions").await
    }
}
