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

pub mod actions;
mod config;
mod error;
pub mod helpers;
mod l10n;
mod model;
mod proposal;
mod service;
mod system_info;

pub use config::L10nConfig;
pub use error::LocaleError;
pub use l10n::{L10n, L10nAction};
pub use model::{Keymap, L10nModel, LocaleEntry, TimezoneEntry};
pub use proposal::L10nProposal;
pub use service::L10nService;
pub use system_info::L10nSystemInfo;
