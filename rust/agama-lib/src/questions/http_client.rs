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

use reqwest::StatusCode;
use tokio::time::sleep;

use crate::base_http_client::{BaseHTTPClient, BaseHTTPClientError};

use super::model::{self, Answer, Question};

pub struct HTTPClient {
    client: BaseHTTPClient,
}

impl HTTPClient {
    pub fn new(client: BaseHTTPClient) -> Result<Self, BaseHTTPClientError> {
        Ok(Self { client })
    }

    pub async fn list_questions(&self) -> Result<Vec<model::Question>, BaseHTTPClientError> {
        self.client.get("/questions").await
    }

    /// Creates question and return newly created question including id
    pub async fn create_question(
        &self,
        question: &Question,
    ) -> Result<Question, BaseHTTPClientError> {
        self.client.post("/questions", question).await
    }

    /// non blocking varient of checking if question has already answer
    pub async fn try_answer(
        &self,
        question_id: u32,
    ) -> Result<Option<Answer>, BaseHTTPClientError> {
        let path = format!("/questions/{}/answer", question_id);
        let result: Result<Option<Answer>, _> = self.client.get(path.as_str()).await;
        match result {
            Err(BaseHTTPClientError::BackendError(code, ref _body_s)) => {
                if code == StatusCode::NOT_FOUND {
                    Ok(None) // no answer yet, fine
                } else {
                    result // pass error
                }
            }
            _ => result, // pass answer
        }
    }

    /// Blocking variant of getting answer for given question.
    pub async fn get_answer(&self, question_id: u32) -> Result<Answer, BaseHTTPClientError> {
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

    pub async fn delete_question(&self, question_id: u32) -> Result<(), BaseHTTPClientError> {
        let path = format!("/questions/{}", question_id);
        self.client.delete_void(path.as_str()).await
    }
}

#[cfg(test)]
mod test {
    use super::model::{GenericAnswer, GenericQuestion};
    use super::*;
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::collections::HashMap;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn questions_client(mock_server_url: String) -> HTTPClient {
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        HTTPClient { client: bhc }
    }

    #[test]
    async fn test_list_questions() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let client = questions_client(server.url("/api"));

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/questions");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"[
                        {
                            "generic": {
                                "id": 42,
                                "class": "foo",
                                "text": "Shape",
                                "options": ["bouba","kiki"],
                                "defaultOption": "bouba",
                                "data": { "a": "A" }
                            },
                            "withPassword":null
                        }
                    ]"#,
                );
        });

        let expected: Vec<model::Question> = vec![Question {
            generic: GenericQuestion {
                id: Some(42),
                class: "foo".to_owned(),
                text: "Shape".to_owned(),
                options: vec!["bouba".to_owned(), "kiki".to_owned()],
                default_option: "bouba".to_owned(),
                data: HashMap::from([("a".to_owned(), "A".to_owned())]),
            },
            with_password: None,
        }];
        let actual = client.list_questions().await?;
        assert_eq!(actual, expected);

        mock.assert();
        Ok(())
    }

    #[test]
    async fn test_create_question() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(POST)
                .path("/api/questions")
                .header("content-type", "application/json")
                .body(
                    r#"{"generic":{"id":null,"class":"fiction.hamlet","text":"To be or not to be","options":["to be","not to be"],"defaultOption":"to be","data":{"a":"A"}},"withPassword":null}"#
                );
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                        "generic": {
                            "id": 7,
                            "class": "fiction.hamlet",
                            "text": "To be or not to be",
                            "options": ["to be","not to be"],
                            "defaultOption": "to be",
                            "data": { "a": "A" }
                        },
                        "withPassword":null
                    }"#,
                );
            });
        let client = questions_client(server.url("/api"));

        let posted_question = Question {
            generic: GenericQuestion {
                id: None,
                class: "fiction.hamlet".to_owned(),
                text: "To be or not to be".to_owned(),
                options: vec!["to be".to_owned(), "not to be".to_owned()],
                default_option: "to be".to_owned(),
                data: HashMap::from([("a".to_owned(), "A".to_owned())]),
            },
            with_password: None,
        };
        let mut expected_question = posted_question.clone();
        expected_question.generic.id = Some(7);

        let actual = client.create_question(&posted_question).await?;
        assert_eq!(actual, expected_question);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        mock.assert();
        Ok(())
    }

    #[test]
    async fn test_try_answer() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let client = questions_client(server.url("/api"));

        let mock = server.mock(|when, then| {
            when.method(GET).path("/api/questions/42/answer");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                        "generic": {
                            "answer": "maybe"
                        },
                        "withPassword":null
                    }"#,
                );
        });

        let expected = Some(Answer {
            generic: GenericAnswer {
                answer: "maybe".to_owned(),
            },
            with_password: None,
        });
        let actual = client.try_answer(42).await?;
        assert_eq!(actual, expected);

        let mock2 = server.mock(|when, then| {
            when.method(GET).path("/api/questions/666/answer");
            then.status(404);
        });
        let actual = client.try_answer(666).await?;
        assert_eq!(actual, None);

        mock.assert();
        mock2.assert();
        Ok(())
    }
}
