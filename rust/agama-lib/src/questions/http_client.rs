use crate::error::ServiceError;

use super::model;

struct HTTPClient {
    client: crate::http_client::HTTPClient,
}

impl HTTPClient {
    pub async fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: crate::http_client::HTTPClient::new().await?
        })
    }

    pub async fn list_questions() -> Result<Vec<model::Question>, ServiceError> {
        Ok(vec![])
    }
}