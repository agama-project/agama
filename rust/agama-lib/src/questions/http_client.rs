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

use std::time::Duration;

use agama_utils::api::{
    config::Patch,
    question::{
        Answer, AnswerRule, Config as QuestionsConfig, Policy, Question, QuestionSpec,
        UpdateOperation,
    },
    Config,
};
use tokio::time::sleep;

use crate::http::{BaseHTTPClient, BaseHTTPClientError};

#[derive(Debug, thiserror::Error)]
pub enum QuestionsHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
    #[error("Unknown question with ID {0}")]
    UnknownQuestion(u32),
}

pub struct HTTPClient {
    client: BaseHTTPClient,
}

impl HTTPClient {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self { client }
    }

    pub async fn get_questions(&self) -> Result<Vec<Question>, QuestionsHTTPClientError> {
        Ok(self.client.get("/v2/questions").await?)
    }

    /// Creates question and return newly created question including id
    pub async fn create_question(
        &self,
        question: &QuestionSpec,
    ) -> Result<Question, QuestionsHTTPClientError> {
        Ok(self.client.post("/v2/questions", question).await?)
    }

    pub async fn get_question(
        &self,
        id: u32,
    ) -> Result<Option<Question>, QuestionsHTTPClientError> {
        let questions = self.get_questions().await?;
        Ok(questions.into_iter().find(|q| q.id == id))
    }

    /// Blocking variant of getting answer for given question.
    pub async fn get_answer(&self, question_id: u32) -> Result<Answer, QuestionsHTTPClientError> {
        loop {
            let question = self.get_question(question_id).await?;
            match question {
                Some(question) => {
                    if let Some(answer) = question.answer {
                        return Ok(answer);
                    }
                }
                None => return Err(QuestionsHTTPClientError::UnknownQuestion(question_id)),
            }
            let duration = Duration::from_secs(1);
            sleep(duration).await;
            // TODO: use websocket to get events instead of polling, but be aware of race condition that
            // auto answer can answer faster before we connect to socket. So ask for answer
            // and meanwhile start checking for events
        }
    }

    pub async fn set_mode(&self, policy: Policy) -> Result<(), QuestionsHTTPClientError> {
        let questions = QuestionsConfig {
            policy: Some(policy),
            ..Default::default()
        };
        let config = Config {
            questions: Some(questions),
            ..Default::default()
        };

        let patch = Patch {
            update: Some(config),
        };

        _ = self.client.patch_void("/v2/config", &patch).await?;
        Ok(())
    }

    pub async fn set_answers(
        &self,
        answers: Vec<AnswerRule>,
    ) -> Result<(), QuestionsHTTPClientError> {
        let questions = QuestionsConfig {
            answers,
            ..Default::default()
        };
        let config = Config {
            questions: Some(questions),
            ..Default::default()
        };

        let patch = Patch {
            update: Some(config),
        };
        self.client.patch_void("/v2/config", &patch).await?;
        Ok(())
    }

    pub async fn delete_question(&self, id: u32) -> Result<(), QuestionsHTTPClientError> {
        let update = UpdateOperation::Delete { id };
        self.client.patch_void("/v2/questions", &update).await?;
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::HTTPClient;
    use crate::http::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn questions_client(mock_server_url: String) -> HTTPClient {
        let bhc = BaseHTTPClient::new(mock_server_url).unwrap();
        HTTPClient { client: bhc }
    }

    #[test]
    async fn test_get_questions() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let client = questions_client(server.url("/api"));

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/v2/questions");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"[
                        {
                            "id": 42,
                            "class": "foo",
                            "text": "Shape",
                            "actions": [
                                { "id": "next", "label": "Next" },
                                { "id": "skip", "label": "Skip" }
                            ],
                            "defaultAction": "skip",
                            "data": { "id": "42" }
                        }
                    ]"#,
                );
        });

        let questions = client.get_questions().await?;

        let question = questions.first().unwrap();
        assert_eq!(question.id, 42);
        assert_eq!(question.spec.class, "foo");
        assert_eq!(question.spec.text, "Shape");
        assert_eq!(question.spec.default_action, Some("skip".to_string()));

        mock.assert();
        Ok(())
    }
}
