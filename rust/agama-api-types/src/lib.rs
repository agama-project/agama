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

//! This crate contains all Agama public types that might be available over
//! the HTTP and WebSocket API.
//!
//! It was extracted out of `agama-utils` because it is by far the heaviest
//! part of that crate to compile (most types here derive `Serialize`,
//! `Deserialize`, `JsonSchema` and `Clone` together). Keeping it as its own
//! crate means that changing an unrelated part of `agama-utils` (its actor
//! system, logging helpers, etc.) doesn't force recompiling this
//! derive-heavy code, and vice versa. `agama-utils` re-exports this crate as
//! `agama_utils::api`, so downstream crates don't need to know about this
//! split.

pub mod kernel_cmdline;
pub mod openapi;

/// Does nothing at runtime, marking the text for translation.
///
/// This is useful when you need both the untranslated id and its translated
/// label, for example.
///
/// This is a deliberate copy of `agama_utils::gettext_noop` (rather than a
/// dependency on `agama-utils`, which would create a circular crate
/// dependency, since `agama-utils` re-exports this crate as its `api`
/// module). It is a one-line identity function used only to mark a string
/// literal for the translation-extracting tools, so duplicating it carries
/// no real cost.
pub fn gettext_noop(text: &str) -> &str {
    text
}

pub mod event;
pub use event::Event;

pub mod progress;
pub use progress::Progress;

pub mod scope;
pub use scope::Scope;

pub mod status;
pub use status::Status;

pub mod issue;
pub use issue::{Issue, IssueMap, IssueWithScope};

mod system_info;
pub use system_info::SystemInfo;

#[cfg(feature = "curl")]
pub mod config;
#[cfg(feature = "curl")]
pub use config::Config;

mod raw_config;
pub use raw_config::RawConfig;

#[cfg(feature = "curl")]
pub mod patch;
#[cfg(feature = "curl")]
pub use patch::Patch;

mod proposal;
pub use proposal::Proposal;

mod action;
pub use {action::Action, action::FinishMethod};

pub mod access;
pub mod bootloader;
#[cfg(feature = "curl")]
pub mod files;
pub mod hostname;
pub mod iscsi;
pub mod l10n;
pub mod manager;
pub mod network;
pub mod ntp;
pub mod proxy;
pub mod query;
pub mod question;
pub mod s390;
pub mod security;
pub mod software;
pub mod storage;
pub mod users;

pub mod problem_details;
pub use problem_details::ProblemDetails;
