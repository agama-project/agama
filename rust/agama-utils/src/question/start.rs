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
            question::{QuestionAnswer, QuestionSpec},
            Event,
        },
        question::{self, message},
    };
    use tokio::sync::broadcast;

    fn build_question_spec() -> QuestionSpec {
        QuestionSpec::new("Do you want to continue?", "continue")
            .with_actions(&[("yes", "Yes"), ("no", "No")])
    }

    #[tokio::test]
    async fn test_ask_and_answer_question() -> Result<(), Box<dyn std::error::Error>> {
        let (events_tx, mut events_rx) = broadcast::channel(16);
        let questions = question::start(events_tx).await.unwrap();
        let question_id = questions
            .call(message::Ask::new(build_question_spec()))
            .await?;

        let answer = QuestionAnswer {
            action: "yes".to_string(),
            value: None,
        };
        questions
            .call(message::Answer {
                id: question_id,
                answer,
            })
            .await?;
        _ = questions.call(message::Get).await?;

        let new_question = events_rx.recv().await?;
        assert!(matches!(new_question, Event::QuestionAdded { id }));

        let answer_question = events_rx.recv().await?;
        assert!(matches!(
            answer_question,
            Event::QuestionAnswered { id: _id }
        ));

        Ok(())
    }
}
