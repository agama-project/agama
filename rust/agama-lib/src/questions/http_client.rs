use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

use super::model::{self, Question};

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

    /// Creates question and return newly created question including id
    pub async fn create_question(&self, question: &Question) -> Result<Question, ServiceError> {
        let response = self.client.post_response("/questions", question).await?;
        if response.status().is_success() {
            let question = response.json().await?;
            Ok(question)
        } else {
            Err(self.client.build_backend_error(response).await)
        }
    }
}
