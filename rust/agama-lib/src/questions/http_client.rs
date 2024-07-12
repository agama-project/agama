use crate::error::ServiceError;

use super::model;

pub struct HTTPClient {
    client: crate::http_client::HTTPClient,
}

impl HTTPClient {
    pub async fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: crate::http_client::HTTPClient::new().await?,
        })
    }

    pub async fn list_questions(&self) -> Result<Vec<model::Question>, ServiceError> {
        let questions = self.client.get_type("/questions").await?;
        Ok(questions)
    }
}
