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

//! Service to keep the installation issues in a centralized place.
//!
//! This service offers and API for other services to register the issues.
//! Additionally, it is responsible for emitting the corresponding event when
//! the list of issues changes.
//!
//! The service can be started calling the [start] function, which returns an
//! [agama_utils::actors::ActorHandler] to interact with it.
//!
//! # Example
//!
//! ```no_run
//! use agama_utils::issue::{self, message};
//! use tokio::sync::mpsc;
//!
//! # tokio_test::block_on(async {
//! async fn use_issues_service() {
//!     let (events_tx, _events_rx) = mpsc::unbounded_channel();
//!     let issues = issue::start(events_tx, None).await.unwrap();
//!     _ = issues.call(message::Update::new("my-service", vec![]));
//! }
//! # });
//!
//! ```

pub mod event;
pub use event::IssuesChanged;

pub mod model;
pub use model::{Issue, IssueSeverity, IssueSource};

pub mod service;
pub use service::Service;

pub mod message;

pub mod start;
pub use start::start;

mod monitor;
