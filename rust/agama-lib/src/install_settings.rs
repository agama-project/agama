//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::settings::{SettingObject, SettingValue, Settings, SettingsError};
use crate::{
    network::NetworkSettings, software::SoftwareSettings, storage::StorageSettings,
    users::UserSettings,
};
use serde::{Deserialize, Serialize};
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
    /// Network settings
    Network,
}

impl Scope {
    /// Returns known scopes
    ///
    // TODO: we can rely on strum so we do not forget to add them
    pub fn all() -> [Scope; 4] {
        [
            Scope::Network,
            Scope::Software,
            Scope::Storage,
            Scope::Users,
        ]
    }
}

impl FromStr for Scope {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "users" => Ok(Self::Users),
            "software" => Ok(Self::Software),
            "storage" => Ok(Self::Storage),
            "network" => Ok(Self::Network),
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
    #[serde(default)]
    pub network: Option<NetworkSettings>,
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
        if self.network.is_some() {
            scopes.push(Scope::Network);
        }
        scopes
    }
}

impl Settings for InstallSettings {
    fn add(&mut self, attr: &str, value: SettingObject) -> Result<(), SettingsError> {
        if let Some((ns, id)) = attr.split_once('.') {
            match ns {
                "network" => {
                    let network = self.network.get_or_insert(Default::default());
                    network.add(id, value)?
                }
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
                _ => return Err(SettingsError::UnknownCollection(attr.to_string())),
            }
        }
        Ok(())
    }

    fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), SettingsError> {
        if let Some((ns, id)) = attr.split_once('.') {
            match ns {
                "network" => {
                    let network = self.network.get_or_insert(Default::default());
                    network.set(id, value)?
                }
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
                _ => return Err(SettingsError::UnknownAttribute(attr.to_string())),
            }
        }
        Ok(())
    }

    fn merge(&mut self, other: &Self) {
        if let Some(other_network) = &other.network {
            let network = self.network.get_or_insert(Default::default());
            network.merge(other_network);
        }

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
