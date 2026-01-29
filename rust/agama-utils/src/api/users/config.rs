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

    pub fn is_empty(&self) -> bool {
        if self.root.as_ref().is_some_and(|r| !r.is_empty()) {
            return false;
        }

        if self.first_user.as_ref().is_some_and(|u| !u.is_empty()) {
            return false;
        }

        true
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
    /// Whether it is an empty user.
    pub fn is_empty(&self) -> bool {
        self.user_name.is_none()
    }

    pub fn is_valid(&self) -> bool {
        self.user_name.as_ref().is_some_and(|n| !n.is_empty())
            && self.full_name.as_ref().is_some_and(|n| !n.is_empty())
            && self.password.as_ref().is_some_and(|p| !p.is_empty())
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

impl UserPassword {
    pub fn is_empty(&self) -> bool {
        self.password.is_empty()
    }
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
        if self
            .password
            .as_ref()
            .is_some_and(|p| !p.password.is_empty())
        {
            return false;
        }

        if self.ssh_public_key.as_ref().is_some_and(|p| !p.is_empty()) {
            return false;
        }

        return true;
    }
}

#[cfg(test)]
mod test {
    use super::{Config, FirstUserConfig, RootUserConfig, UserPassword};

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

    #[test]
    fn test_is_empty() {
        assert_eq!(Config::default().is_empty(), true);

        let empty_user_config = Config {
            first_user: Some(FirstUserConfig::default()),
            ..Default::default()
        };
        assert_eq!(empty_user_config.is_empty(), true);

        let empty_root_config = Config {
            root: Some(RootUserConfig::default()),
            ..Default::default()
        };
        assert_eq!(empty_root_config.is_empty(), true);

        let password = UserPassword {
            password: "secret".to_string(),
            hashed_password: false,
        };
        let empty_password = UserPassword {
            password: "".to_string(),
            hashed_password: false,
        };

        let user_with_password = FirstUserConfig {
            user_name: Some("jane".to_string()),
            password: Some(password.clone()),
            ..Default::default()
        };
        let user_with_password_config = Config {
            first_user: Some(user_with_password),
            ..Default::default()
        };
        assert_eq!(user_with_password_config.is_empty(), false);

        let root_with_password = RootUserConfig {
            password: Some(password.clone()),
            ..Default::default()
        };
        let root_with_password_config = Config {
            root: Some(root_with_password),
            ..Default::default()
        };
        assert_eq!(root_with_password_config.is_empty(), false);

        let root_with_empty_password = RootUserConfig {
            password: Some(empty_password.clone()),
            ..Default::default()
        };
        let root_with_empty_password_config = Config {
            root: Some(root_with_empty_password),
            ..Default::default()
        };
        assert_eq!(root_with_empty_password_config.is_empty(), true);

        let root_with_ssh_key = RootUserConfig {
            ssh_public_key: Some("12345678".to_string()),
            ..Default::default()
        };
        let root_with_ssh_key_config = Config {
            root: Some(root_with_ssh_key),
            ..Default::default()
        };
        assert_eq!(root_with_ssh_key_config.is_empty(), false);
    }

    #[test]
    fn test_user_is_valid() {
        assert_eq!(FirstUserConfig::default().is_valid(), false);

        let valid_user = FirstUserConfig {
            user_name: Some("firstuser".to_string()),
            full_name: Some("First User".to_string()),
            password: Some(UserPassword {
                password: "12345678".to_string(),
                hashed_password: false,
            }),
        };
        assert_eq!(valid_user.is_valid(), true);

        let empty_user_name = FirstUserConfig {
            user_name: Some("".to_string()),
            full_name: Some("First User".to_string()),
            password: Some(UserPassword {
                password: "12345678".to_string(),
                hashed_password: false,
            }),
        };
        assert_eq!(empty_user_name.is_valid(), false);

        let empty_full_name = FirstUserConfig {
            user_name: Some("firstuser".to_string()),
            full_name: Some("".to_string()),
            password: Some(UserPassword {
                password: "12345678".to_string(),
                hashed_password: false,
            }),
        };
        assert_eq!(empty_full_name.is_valid(), false);

        let empty_password = FirstUserConfig {
            user_name: Some("firstuser".to_string()),
            full_name: Some("First User".to_string()),
            password: Some(UserPassword {
                password: "".to_string(),
                hashed_password: false,
            }),
        };
        assert_eq!(empty_password.is_valid(), false);
    }
}
