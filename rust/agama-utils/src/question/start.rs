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

use super::{service, Service};
use crate::{
    actor::{self, Handler},
    api::event,
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Service(#[from] service::Error),
}

pub async fn start(events: event::Sender) -> Result<Handler<Service>, Error> {
    let service = Service::new(events);
    let handler = actor::spawn(service);

    Ok(handler)
}

#[cfg(test)]
mod tests {
    use crate::{
        api::{
            question::{Answer, AnswerRule, Config, Policy, QuestionSpec},
            Event,
        },
        question::{self, message},
    };
    use tokio::sync::broadcast;

    fn build_question_spec() -> QuestionSpec {
        QuestionSpec::new("Do you want to continue?", "continue")
            .with_actions(&[("yes", "Yes"), ("no", "No")])
            .with_default_action("no")
    }

    #[tokio::test]
    async fn test_ask_and_answer_question() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut events_rx) = broadcast::channel(16);
        let questions = question::start(events_tx).await.unwrap();

        // Ask the question
        let question = questions
            .call(message::Ask::new(build_question_spec()))
            .await?;
        assert!(question.answer.is_none());

        // Answer the question
        let answer = Answer {
            action: "yes".to_string(),
            value: None,
        };
        questions
            .call(message::Answer {
                id: question.id,
                answer,
            })
            .await?;

        let new_question = events_rx.recv().await?;
        assert!(matches!(new_question, Event::QuestionAdded { id: _ }));

        let answer_question = events_rx.recv().await?;
        assert!(matches!(
            answer_question,
            Event::QuestionAnswered { id: _id }
        ));

        Ok(())
    }

    #[tokio::test]
    async fn test_auto_answer_question_by_policy() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut _events_rx) = broadcast::channel(16);
        let questions = question::start(events_tx).await.unwrap();

        // Set the configuration
        let config = Config {
            policy: Some(Policy::Auto),
            ..Default::default()
        };
        questions.call(message::SetConfig::new(config)).await?;

        // Ask the question
        let question = questions
            .call(message::Ask::new(build_question_spec()))
            .await?;

        // Check the answer
        assert!(question.answer.is_some());

        Ok(())
    }

    #[tokio::test]
    async fn test_auto_answer_question_by_rule() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut _events_rx) = broadcast::channel(16);
        let questions = question::start(events_tx).await.unwrap();

        // Define a rule and an answer.
        let answer = Answer {
            action: "no".to_string(),
            value: None,
        };
        let rule_by_class = AnswerRule {
            text: None,
            class: Some("continue".to_string()),
            data: None,
            answer: answer.clone(),
        };

        // Set the configuration
        let config = Config {
            policy: Some(Policy::User),
            answers: vec![rule_by_class],
        };
        questions.call(message::SetConfig::new(config)).await?;

        // Ask the question
        let question = questions
            .call(message::Ask::new(build_question_spec()))
            .await?;

        // Check the answer
        assert_eq!(question.answer, Some(answer));

        Ok(())
    }

    #[tokio::test]
    async fn test_delete_question() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut _events_rx) = broadcast::channel(16);
        let questions = question::start(events_tx).await.unwrap();

        // Ask the question
        let question = questions
            .call(message::Ask::new(build_question_spec()))
            .await?;

        let all_questions = questions.call(message::Get).await?;
        let found = all_questions.into_iter().find(|q| q.id == question.id);
        assert!(found.is_some());

        // Delete the question
        questions
            .call(message::Delete { id: question.id })
            .await
            .unwrap();
        let all_questions = questions.call(message::Get).await?;
        let found = all_questions.into_iter().find(|q| q.id == question.id);
        assert!(found.is_none());

        Ok(())
    }
}
