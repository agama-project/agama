use std::time::Duration;

use reqwest::StatusCode;
use tokio::time::sleep;

use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

use super::model::{self, Answer, Question};

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

    /// non blocking varient of checking if question has already answer
    pub async fn try_answer(&self, question_id: u32) -> Result<Option<Answer>, ServiceError> {
        let path = format!("/questions/{}/answer", question_id);
        let response = self.client.get_response(path.as_str()).await?;
        if response.status() == StatusCode::NOT_FOUND {
            Ok(None)
        } else if response.status().is_success() {
            let answer = response.json().await?;
            Ok(answer)
        } else {
            Err(self.client.build_backend_error(response).await)
        }
    }

    /// Blocking variant of getting answer for given question.
    pub async fn get_answer(&self, question_id: u32) -> Result<Answer, ServiceError> {
        loop {
            let answer = self.try_answer(question_id).await?;
            if let Some(result) = answer {
                return Ok(result);
            }
            let duration = Duration::from_secs(1);
            sleep(duration).await;
            // TODO: use websocket to get events instead of polling, but be aware of race condition that
            // auto answer can answer faster before we connect to socket. So ask for answer
            // and meanwhile start checking for events
        }
    }

    pub async fn delete_question(&self, question_id: u32) -> Result<(), ServiceError> {
        let path = format!("/questions/{}/answer", question_id);
        self.client.delete(path.as_str()).await
    }
}
