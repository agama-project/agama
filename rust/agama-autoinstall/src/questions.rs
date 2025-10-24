// Copyright (c) [2025] SUSE LLC
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

//! This module offers a mechanism to ask questions to users.

use std::collections::HashMap;

use agama_lib::{
    http::BaseHTTPClient,
    questions::{
        http_client::HTTPClient as QuestionsHTTPClient,
        model::{GenericQuestion, Question},
    },
};

pub struct UserQuestions {
    questions: QuestionsHTTPClient,
}

impl UserQuestions {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            questions: QuestionsHTTPClient::new(client),
        }
    }

    /// Asks the user whether to retry loading the profile.
    pub async fn should_retry(&self, text: &str, error: &str) -> anyhow::Result<bool> {
        let data = HashMap::from([("error".to_string(), error.to_string())]);
        let generic = GenericQuestion {
            id: None,
            class: "load.retry".to_string(),
            text: text.to_string(),
            options: vec!["Yes".to_string(), "No".to_string()],
            default_option: "No".to_string(),
            data,
        };
        let question = Question {
            generic,
            with_password: None,
        };
        let question = self.questions.create_question(&question).await?;
        let answer = self
            .questions
            .get_answer(question.generic.id.unwrap())
            .await?;
        Ok(answer.generic.answer == "Yes")
    }
}
