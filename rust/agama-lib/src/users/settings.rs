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

use serde::{Deserialize, Serialize};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(rename = "user", skip_serializing_if = "Option::is_none")]
    pub first_user: Option<FirstUserSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<RootUserSettings>,
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserSettings {
    /// First user's full name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    /// First user's username
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user_name: Option<String>,
    /// First user's password (in clear text)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Whether the password is hashed or is plain text
    #[serde(skip_serializing_if = "Self::skip_hashed")]
    pub hashed_password: Option<bool>,
}

impl FirstUserSettings {
    // as dbus provides only boolean it is hard to distinguish
    // false and not set. So act for false like not set as it is default.
    fn skip_hashed(value: &Option<bool>) -> bool {
        *value == Some(false)
    }

    pub fn skip_export(&self) -> bool {
        self.full_name.is_none()
            && self.user_name.is_none()
            && self.password.is_none()
            && Self::skip_hashed(&self.hashed_password)
    }
}

/// Root user settings
///
/// Holds the settings for the root user.
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RootUserSettings {
    /// Root's password (in clear text)
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// Whether the password is hashed or is plain text
    #[serde(skip_serializing)]
    pub hashed_password: Option<bool>,
    /// Root SSH public key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_public_key: Option<String>,
}


impl RootUserSettings {
    pub fn skip_export(&self) -> bool {
        self.password.is_none()
            && self.hashed_password.is_none()
            && self.ssh_public_key.is_none()
    }
}