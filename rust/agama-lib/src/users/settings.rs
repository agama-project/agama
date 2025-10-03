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

use super::{FirstUser, RootUser};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(rename = "user")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub first_user: Option<FirstUserSettings>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<RootUserSettings>,
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserSettings {
    /// First user's full name
    pub full_name: Option<String>,
    /// First user password
    #[serde(flatten)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<UserPassword>,
    /// First user's username
    pub user_name: Option<String>,
}

impl FirstUserSettings {
    /// Whether it is a valid user.
    pub fn is_valid(&self) -> bool {
        self.user_name.is_some()
    }
}

impl From<FirstUser> for FirstUserSettings {
    fn from(value: FirstUser) -> Self {
        let user_name = if value.user_name.is_empty() {
            None
        } else {
            Some(value.user_name.clone())
        };

        let password = if value.password.is_empty() {
            None
        } else {
            Some(UserPassword {
                password: value.password,
                hashed_password: value.hashed_password,
            })
        };

        let full_name = if value.full_name.is_empty() {
            None
        } else {
            Some(value.full_name)
        };

        Self {
            user_name,
            password,
            full_name,
        }
    }
}

/// Represents a user password.
///
/// It holds the password and whether it is a hashed or a plain text password.
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UserPassword {
    /// User password
    pub password: String,
    /// Whether the password is hashed or is plain text
    #[serde(default)]
    pub hashed_password: bool,
}

/// Root user settings
///
/// Holds the settings for the root user.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootUserSettings {
    /// Root user password
    #[serde(flatten)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<UserPassword>,
    /// Root SSH public key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_public_key: Option<String>,
}

impl RootUserSettings {
    pub fn is_empty(&self) -> bool {
        self.password.is_none() && self.ssh_public_key.is_none()
    }
}

impl From<RootUser> for RootUserSettings {
    fn from(value: RootUser) -> Self {
        let password = value
            .password
            .filter(|password| !password.is_empty())
            .map(|password| UserPassword {
                password,
                hashed_password: value.hashed_password.unwrap_or_default(),
            });
        let ssh_public_key = value.ssh_public_key.filter(|key| !key.is_empty());
        Self {
            password,
            ssh_public_key,
        }
    }
}

#[cfg(test)]
mod test {
    use crate::users::{settings::UserPassword, FirstUser, RootUser};

    use super::{FirstUserSettings, RootUserSettings};

    #[test]
    fn test_user_settings_from_first_user() {
        let empty = FirstUser {
            full_name: "".to_string(),
            user_name: "".to_string(),
            password: "".to_string(),
            hashed_password: false,
        };
        let settings: FirstUserSettings = empty.into();
        assert_eq!(settings.full_name, None);
        assert_eq!(settings.user_name, None);
        assert_eq!(settings.password, None);

        let user = FirstUser {
            full_name: "SUSE".to_string(),
            user_name: "suse".to_string(),
            password: "nots3cr3t".to_string(),
            hashed_password: false,
        };
        let settings: FirstUserSettings = user.into();
        assert_eq!(settings.full_name, Some("SUSE".to_string()));
        assert_eq!(settings.user_name, Some("suse".to_string()));
        let password = settings.password.unwrap();
        assert_eq!(password.password, "nots3cr3t".to_string());
        assert_eq!(password.hashed_password, false);
    }

    #[test]
    fn test_root_settings_from_root_user() {
        let empty = RootUser {
            password: None,
            hashed_password: None,
            ssh_public_key: None,
        };

        let settings: RootUserSettings = empty.into();
        assert_eq!(settings.password, None);
        assert_eq!(settings.ssh_public_key, None);

        let with_password = RootUser {
            password: Some("nots3cr3t".to_string()),
            hashed_password: Some(false),
            ..Default::default()
        };
        let settings: RootUserSettings = with_password.into();
        let password = settings.password.unwrap();
        assert_eq!(password.password, "nots3cr3t".to_string());
        assert_eq!(password.hashed_password, false);

        let with_ssh_public_key = RootUser {
            ssh_public_key: Some("ssh-rsa ...".to_string()),
            ..Default::default()
        };
        let settings: RootUserSettings = with_ssh_public_key.into();
        assert_eq!(settings.ssh_public_key, Some("ssh-rsa ...".to_string()));
    }

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
