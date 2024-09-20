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

//! Representation of the localization settings

use serde::{Deserialize, Serialize};

/// Localization settings for the system being installed (not the UI)
/// FIXME: this one is close to CLI. A possible duplicate close to HTTP is LocaleConfig
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LocalizationSettings {
    /// like "en_US.UTF-8"
    pub language: Option<String>,
    /// like "cz(qwerty)"
    pub keyboard: Option<String>,
    /// like "Europe/Berlin"
    pub timezone: Option<String>,
}
