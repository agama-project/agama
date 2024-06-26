//! Configuration settings handling
//!
//! This module implements the mechanisms to load and store the installation settings.
use crate::{
    localization::LocalizationSettings, network::NetworkSettings, product::ProductSettings,
    software::SoftwareSettings, users::UserSettings,
};
use serde::{Deserialize, Serialize};
use serde_json::value::RawValue;
use std::default::Default;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

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
    pub product: Option<ProductSettings>,
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<Box<RawValue>>,
    #[serde(default, rename = "legacyAutoyastStorage")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage_autoyast: Option<Box<RawValue>>,
    #[serde(default)]
    pub network: Option<NetworkSettings>,
    #[serde(default)]
    pub localization: Option<LocalizationSettings>,
}

impl InstallSettings {
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self, std::io::Error> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let data = serde_json::from_reader(reader)?;
        Ok(data)
    }
}
