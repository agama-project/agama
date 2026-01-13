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

use merge::Merge;
use serde::{Deserialize, Serialize};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[merge(strategy = merge::option::overwrite_none)]
    #[serde(rename = "user")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_user: Option<FirstUserConfig>,
    #[merge(strategy = merge::option::overwrite_none)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<RootUserConfig>,
}

impl Config {
    pub fn new() -> Self {
        Self {
            first_user: None,
            root: None,
        }
    }

    pub fn to_api(&self) -> Option<Config> {
        if self.root.is_none() && self.first_user.is_none() {
            return None;
        }

        Some(self.clone())
    }
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserConfig {
    /// First user's full name
    #[merge(strategy = merge::option::overwrite_none)]
    pub full_name: Option<String>,
    /// First user password
    #[serde(flatten)]
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub password: Option<UserPassword>,
    /// First user's username
    #[merge(strategy = merge::option::overwrite_none)]
    pub user_name: Option<String>,
}

impl FirstUserConfig {
    /// Whether it is a valid user.
    pub fn is_valid(&self) -> bool {
        self.user_name.is_some()
    }
}

/// Represents a user password.
///
/// It holds the password and whether it is a hashed or a plain text password.
#[derive(Clone, Debug, Merge, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserPassword {
    /// User password
    #[merge(strategy = overwrite_if_not_empty)]
    pub password: String,
    /// Whether the password is hashed or is plain text
    #[merge(strategy = merge::bool::overwrite_false)]
    #[serde(default)]
    pub hashed_password: bool,
}

fn overwrite_if_not_empty(old: &mut String, new: String) {
    if !new.is_empty() {
        *old = new;
    }
}

/// Root user settings
///
/// Holds the settings for the root user.
#[derive(Clone, Debug, Default, Merge, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootUserConfig {
    /// Root user password
    #[merge(strategy = merge::option::overwrite_none)]
    #[serde(flatten)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<UserPassword>,
    /// Root SSH public key
    #[merge(strategy = merge::option::overwrite_none)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_public_key: Option<String>,
}

impl RootUserConfig {
    pub fn is_empty(&self) -> bool {
        self.password.is_none() && self.ssh_public_key.is_none()
    }
}

#[cfg(test)]
mod test {
    use super::{FirstUserConfig, RootUserConfig, UserPassword};

    #[test]
    fn test_parse_user_password() {
        let password_str = r#"{ "password": "$a$b123", "hashedPassword": true }"#;
        let password: UserPassword = serde_json::from_str(&password_str).unwrap();
        assert_eq!(&password.password, "$a$b123");
        assert_eq!(password.hashed_password, true);

        let password_str = r#"{ "password": "$a$b123" }"#;
        let password: UserPassword = serde_json::from_str(&password_str).unwrap();
        assert_eq!(&password.password, "$a$b123");
        assert_eq!(password.hashed_password, false);
    }
}
