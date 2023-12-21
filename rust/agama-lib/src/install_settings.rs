//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::{
    network::NetworkSettings, product::ProductSettings, software::SoftwareSettings,
    storage::StorageSettings, users::UserSettings,
};
use agama_settings::Settings;
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
    /// Product settings
    Product,
}

impl Scope {
    /// Returns known scopes
    ///
    // TODO: we can rely on strum so we do not forget to add them
    pub fn all() -> [Scope; 5] {
        [
            Scope::Network,
            Scope::Product,
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
            "product" => Ok(Self::Product),
            _ => Err("Unknown section"),
        }
    }
}

/// Installation settings
///
/// This struct represents installation settings. It serves as an entry point and it is composed of
/// other structs which hold the settings for each area ("users", "software", etc.).
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSettings {
    #[serde(default, flatten)]
    #[settings(nested, flatten, alias = "root")]
    pub user: Option<UserSettings>,
    #[serde(default)]
    #[settings(nested)]
    pub software: Option<SoftwareSettings>,
    #[serde(default)]
    #[settings(nested)]
    pub product: Option<ProductSettings>,
    #[serde(default)]
    #[settings(nested)]
    pub storage: Option<StorageSettings>,
    #[serde(default)]
    #[settings(nested)]
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
        if self.product.is_some() {
            scopes.push(Scope::Product);
        }
        scopes
    }
}
