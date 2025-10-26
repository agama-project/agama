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

//! This module contains all Agama public types that might be available over
//! the HTTP and WebSocket API.

pub mod event;
pub use event::Event;

pub mod progress;
pub use progress::Progress;

pub mod scope;
pub use scope::Scope;

pub mod status;
pub use status::Status;

pub mod issue;
pub use issue::{Issue, IssueMap, IssueSeverity, IssueSource};

mod system_info;
pub use system_info::SystemInfo;

pub mod config;
pub use config::Config;

mod proposal;
pub use proposal::Proposal;

mod action;
pub use action::Action;

pub mod l10n;
pub mod question;
pub mod software;
