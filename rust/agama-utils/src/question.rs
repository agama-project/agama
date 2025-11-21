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

//! Service to handle questions for users.
//!
//! This service offers and API to register and answer questions. The questions
//! can be answered:
//!
//! * By the user (the UI is responsible for updating the question with the given answer).
//! * Using a pre-defined answer for specific questions (set through the `SetConfig` message).
//! * Using the default action (set through the `SetConfig` message).
//!
//! The service can be started calling the [start] function, which returns an
//! [agama_utils::actors::ActorHandler] to interact with it.
//!
//! # Example
//!
//! ```no_run
//! use agama_utils::{
//!     api::question::QuestionSpec,
//!     question::{self, message},
//! };
//! use tokio::sync::broadcast;
//!
//! # tokio_test::block_on(async {
//! async fn use_questions_service() {
//!     let (events_tx, _events_rx) = broadcast::channel(16);
//!
//!     let question = QuestionSpec::new("Please, enter a username", "username")
//!        .as_string()
//!        .with_actions(&[("next", "Next"), ("cancel", "Cancel")]);
//!     let questions = question::start(events_tx).await.unwrap();
//!     _ = questions.call(message::Ask::new(question));
//! }
//! # });
//! ```
pub mod service;
use std::time::Duration;

pub use service::Service;

pub mod message;

pub mod start;
pub use start::start;
use tokio::time::sleep;

use crate::{
    actor::Handler,
    api::question::{Answer, QuestionSpec},
    question,
};

#[derive(thiserror::Error, Debug)]
pub enum AskError {
    #[error("Question not found")]
    QuestionNotFound,
    #[error(transparent)]
    Service(#[from] question::service::Error),
    #[error(transparent)]
    Actor(#[from] crate::actor::Error),
}

/// Asks a question and waits until it is answered.
///
/// This is a helper function for internal Rust services that have a direct handler to the
/// `question::Service` and need to ask a question and wait for the answer in a
/// synchronous-like manner within an `async` context. It simplifies the process by
/// abstracting away the need to listen for events or poll the API, which would
/// typically be done by an external client (like a web UI).
///
/// The function sends the question to the `question::Service` and then polls for an
/// answer. Once the question is answered (either by a user, a pre-configured rule,
/// or a default policy), the function returns the answer and deletes the question
/// from the service to clean up.
///
/// # Arguments
/// * `handler` - A handler to the `question::Service`.
/// * `question` - The `QuestionSpec` defining the question to be asked.
///
/// # Errors
/// This function can return the following errors:
/// * `AskError::QuestionNotFound`: If the question is deleted by another process before it can be answered.
/// * `AskError::Service`: If there is an error within the `question::Service` actor.
/// * `AskError::Actor`: If there is a communication error with the actor system (e.g., the actor task has terminated).
pub async fn ask_question(
    handler: &Handler<question::Service>,
    question: QuestionSpec,
) -> Result<Answer, AskError> {
    let result = handler.call(message::Ask::new(question)).await?;
    let mut answer = result.answer;
    while answer.is_none() {
        // FIXME: use more efficient way than active polling
        sleep(Duration::from_secs(1)).await;
        let questions = handler.call(message::Get {}).await?;
        let new_question = questions.iter().find(|q| q.id == result.id);
        let Some(new_question) = new_question else {
            // someone remove the question. Should not happen
            return Err(AskError::QuestionNotFound);
        };
        answer = new_question.answer.clone();
    }
    handler.cast(message::Delete { id: result.id })?;
    // here unwrap is ok as we know it cannot be none due to previous logic in while loop
    Ok(answer.unwrap())
}
