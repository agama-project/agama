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

mod config;
mod error;
mod model;
mod proposal;
mod system_info;
mod handler;
mod service;

pub mod actions;
pub mod helpers;

pub(crate) use service::{Service, Message};
pub(crate) use model::{Keymap, LocaleEntry, TimezoneEntry, Model};

pub use system_info::SystemInfo;
pub use proposal::Proposal;
pub use config::L10nConfig;
pub use error::LocaleError;
pub use service::L10nAction;
pub use handler::Handler;
