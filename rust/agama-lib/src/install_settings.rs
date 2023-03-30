//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::settings::{SettingObject, SettingValue, Settings};
use agama_derive::Settings;
use serde::{Deserialize, Serialize};
use std::convert::TryFrom;
use std::default::Default;
use std::str::FromStr;

/// Settings scopes
///
/// They are used to limit the reading/writing of settings. For instance, if the Scope::Users is
/// given, only the data related to users (UsersStore) are read/written.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Scope {
    /// User settings
    Users,
    /// Software settings
    Software,
    /// Storage settings
    Storage,
}

impl Scope {
    /// Returns known scopes
    ///
    // TODO: we can rely on strum so we do not forget to add them
    pub fn all() -> [Scope; 3] {
        [Scope::Software, Scope::Storage, Scope::Users]
    }
}

impl FromStr for Scope {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "users" => Ok(Self::Users),
            "software" => Ok(Self::Software),
            "storage" => Ok(Self::Storage),
            _ => Err("Unknown section"),
        }
    }
}

/// Installation settings
///
/// This struct represents installation settings. It serves as an entry point and it is composed of
/// other structs which hold the settings for each area ("users", "software", etc.).
#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettings {
    #[serde(default, flatten)]
    pub user: Option<UserSettings>,
    #[serde(default)]
    pub software: Option<SoftwareSettings>,
    #[serde(default)]
    pub storage: Option<StorageSettings>,
}

impl InstallSettings {
    pub fn defined_scopes(&self) -> Vec<Scope> {
        let mut scopes = vec![];
        if self.user.is_some() {
            scopes.push(Scope::Users);
        }

        if self.storage.is_some() {
            scopes.push(Scope::Storage);
        }

        if self.software.is_some() {
            scopes.push(Scope::Software);
        }
        scopes
    }
}

impl Settings for InstallSettings {
    fn add(&mut self, attr: &str, value: SettingObject) -> Result<(), &'static str> {
        if let Some((ns, id)) = attr.split_once('.') {
            match ns {
                "software" => {
                    let software = self.software.get_or_insert(Default::default());
                    software.add(id, value)?
                }
                "user" => {
                    let user = self.user.get_or_insert(Default::default());
                    user.add(id, value)?
                }
                "storage" => {
                    let storage = self.storage.get_or_insert(Default::default());
                    storage.add(id, value)?
                }
                _ => return Err("unknown attribute"),
            }
        }
        Ok(())
    }

    fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), &'static str> {
        if let Some((ns, id)) = attr.split_once('.') {
            match ns {
                "software" => {
                    let software = self.software.get_or_insert(Default::default());
                    software.set(id, value)?
                }
                "user" => {
                    let user = self.user.get_or_insert(Default::default());
                    // User settings are flatten. Pass the full attribute name.
                    user.set(attr, value)?
                }
                "root" => {
                    let root = self.user.get_or_insert(Default::default());
                    // Root settings are flatten. Pass the full attribute name.
                    root.set(attr, value)?
                }
                "storage" => {
                    let storage = self.storage.get_or_insert(Default::default());
                    storage.set(id, value)?
                }
                _ => return Err("unknown attribute"),
            }
        }
        Ok(())
    }

    fn merge(&mut self, other: &Self) {
        if let Some(other_software) = &other.software {
            let software = self.software.get_or_insert(Default::default());
            software.merge(other_software);
        }

        if let Some(other_user) = &other.user {
            let user = self.user.get_or_insert(Default::default());
            user.merge(other_user);
        }

        if let Some(other_storage) = &other.storage {
            let storage = self.storage.get_or_insert(Default::default());
            storage.merge(other_storage);
        }
    }
}

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

/// Storage settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSettings {
    /// Whether LVM should be enabled
    pub lvm: Option<bool>,
    /// Encryption password for the storage devices (in clear text)
    pub encryption_password: Option<String>,
    /// Devices to use in the installation
    #[collection_setting]
    pub devices: Vec<Device>,
}

/// Device to use in the installation
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    /// Device name (e.g., "/dev/sda")
    pub name: String,
}

impl TryFrom<SettingObject> for Device {
    type Error = &'static str;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        match value.0.get("name") {
            Some(name) => Ok(Device {
                name: name.clone().try_into()?,
            }),
            None => Err("'name' key not found"),
        }
    }
}

/// Software settings for installation
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftwareSettings {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    pub product: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

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
