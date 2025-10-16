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
pub use service::Service;

pub mod message;

pub mod start;
pub use start::start;
