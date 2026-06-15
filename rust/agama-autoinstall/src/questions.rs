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

use agama_lib::{http::BaseHTTPClient, questions::http_client::HTTPClient as QuestionsHTTPClient};
use agama_utils::api::question::QuestionSpec;

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
    pub async fn should_retry(
        &self,
        text: &str,
        error: &str,
        url: &str,
    ) -> anyhow::Result<Option<String>> {
        let localized_retry = gettextrs::gettext("Reload configuration");
        let localized_manual = gettextrs::gettext("Skip and configure manually");
        let question = QuestionSpec::new(text, "load.retry")
            .with_actions(&[
                ("Retry", localized_retry.as_str()),
                ("Manual", localized_manual.as_str()),
            ])
            .as_string()
            .with_default_action("Manual")
            .with_data(&[("error", error), ("originalValue", url)]);

        let question = self.questions.create_question(&question).await?;
        let answer = self.questions.get_answer(question.id).await?;
        if answer.action == "Manual" {
            Ok(None)
        } else {
            Ok(Some(answer.value.unwrap_or(url.to_string())))
        }
    }
}
