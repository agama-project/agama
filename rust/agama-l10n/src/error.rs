// Copyright (c) [2024] SUSE LLC
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

use crate::Message;
use agama_locale_data::{InvalidKeymapId, InvalidLocaleId, InvalidTimezoneId, KeymapId, LocaleId};
use agama_utils::ServiceError;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(LocaleId),
    #[error("Invalid locale: {0}")]
    InvalidLocale(#[from] InvalidLocaleId),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid timezone")]
    InvalidTimezone(#[from] InvalidTimezoneId),
    #[error("Unknown keymap: {0}")]
    UnknownKeymap(KeymapId),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymapId),
    #[error("Could not apply the l10n settings: {0}")]
    Commit(#[from] std::io::Error),
    #[error("Could not merge the current and the new configuration")]
    Merge(#[from] serde_json::error::Error),
    #[error(transparent)]
    ServiceError(#[from] ServiceError<Message>),
}
