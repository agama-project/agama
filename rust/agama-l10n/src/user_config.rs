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

use crate::Config;
use serde::{Deserialize, Serialize};

/// Localization configuration for the target system.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserConfig {
    /// Locale (e.g., "en_US.UTF-8").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
    /// Keymap (e.g., "us", "cz(qwerty)", etc.).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyboard: Option<String>,
    /// Timezone (e.g., "Europe/Berlin").
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,
}

impl From<&Config> for UserConfig {
    fn from(config: &Config) -> Self {
        UserConfig {
            language: Some(config.locale.to_string()),
            keyboard: Some(config.keymap.to_string()),
            timezone: Some(config.timezone.to_string()),
        }
    }
}
