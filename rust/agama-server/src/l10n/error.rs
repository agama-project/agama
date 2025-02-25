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

use agama_locale_data::{InvalidKeymap, InvalidLocaleCode, KeymapId, LocaleId};

#[derive(thiserror::Error, Debug)]
pub enum LocaleError {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(LocaleId),
    #[error("Invalid locale: {0}")]
    InvalidLocale(#[from] InvalidLocaleCode),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Unknown keymap: {0}")]
    UnknownKeymap(KeymapId),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymap),
    #[error("Could not apply the changes")]
    Commit(#[from] std::io::Error),
}
