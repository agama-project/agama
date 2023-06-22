use crate::settings::{SettingValue, Settings};
use agama_derive::Settings;
use serde::{Deserialize, Serialize};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(rename = "user")]
    pub first_user: Option<FirstUserSettings>,
    pub root: Option<RootUserSettings>,
}

impl Settings for UserSettings {
    fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), &'static str> {
        if let Some((ns, id)) = attr.split_once('.') {
            match ns {
                "user" => {
                    let first_user = self.first_user.get_or_insert(Default::default());
                    first_user.set(id, value)?
                }
                "root" => {
                    let root_user = self.root.get_or_insert(Default::default());
                    root_user.set(id, value)?
                }
                _ => return Err("unknown attribute"),
            }
        }
        Ok(())
    }

    fn merge(&mut self, other: &Self) {
        if let Some(other_first_user) = &other.first_user {
            let first_user = self.first_user.get_or_insert(Default::default());
            first_user.merge(other_first_user);
        }

        if let Some(other_root) = &other.root {
            let root = self.root.get_or_insert(Default::default());
            root.merge(other_root);
        }
    }
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserSettings {
    /// First user's full name
    pub full_name: Option<String>,
    /// First user's username
    pub user_name: Option<String>,
    /// First user's password (in clear text)
    pub password: Option<String>,
    /// Whether auto-login should enabled or not
    pub autologin: Option<bool>,
}

/// Root user settings
///
/// Holds the settings for the root user.
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootUserSettings {
    /// Root's password (in clear text)
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// Root SSH public key
    pub ssh_public_key: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_user_settings_merge() {
        let mut user1 = UserSettings::default();
        let user2 = UserSettings {
            first_user: Some(FirstUserSettings {
                full_name: Some("Jane Doe".to_string()),
                ..Default::default()
            }),
            root: Some(RootUserSettings {
                password: Some("nots3cr3t".to_string()),
                ..Default::default()
            }),
        };
        user1.merge(&user2);
        let first_user = user1.first_user.unwrap();
        assert_eq!(first_user.full_name, Some("Jane Doe".to_string()));
        let root_user = user1.root.unwrap();
        assert_eq!(root_user.password, Some("nots3cr3t".to_string()));
    }

    #[test]
    fn test_merge() {
        let mut user1 = FirstUserSettings::default();
        let user2 = FirstUserSettings {
            full_name: Some("Jane Doe".to_owned()),
            autologin: Some(true),
            ..Default::default()
        };
        user1.merge(&user2);
        assert_eq!(user1.full_name.unwrap(), "Jane Doe")
    }
}