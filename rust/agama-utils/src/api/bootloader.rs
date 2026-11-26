// Copyright (c) [2025] SUSE LLC
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
//! Implements a data model for Bootloader configuration.

use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use strum::{AsRefStr, Display};

/// Bootloader type.
#[derive(
    Copy, Clone, Debug, Serialize, Deserialize, PartialEq, Eq, JsonSchema, Display, AsRefStr,
)]
#[strum(serialize_all = "kebab-case")]
#[serde(rename_all = "kebab-case")]
pub enum BootloaderType {
    Grub2,
    SystemdBoot,
    None,
}

/// Describes what Agama proposes for the bootloader in the target system.
#[derive(Clone, Debug, Deserialize, Serialize, JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "bootloader.Proposal")]
pub struct Proposal {
    /// Bootloader type.
    pub r#type: BootloaderType,
}

/// Bootloader configuration.
#[derive(Clone, Debug, Serialize, Deserialize, Default, PartialEq, Merge, JsonSchema)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[merge(strategy = merge::option::overwrite_none)]
#[schemars(rename = "bootloader.Config", title = "Bootloader settings")]
pub struct Config {
    /// Bootloader type.
    ///
    /// Supported options are `grub2`, `systemd-boot`, and `none`.
    /// Note that `systemd-boot` can only be installed on EFI systems.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<BootloaderType>,
    /// Whether bootloader should stop on boot menu.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_on_boot_menu: Option<bool>,
    /// Bootloader timeout.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    /// Bootloader extra kernel parameters.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_kernel_params: Option<String>,
    /// Whether bootloader should update persistent RAM.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update_nvram: Option<bool>,
}

impl Config {
    pub fn is_empty(&self) -> bool {
        self == &Self::default()
    }

    pub fn to_option(self) -> Option<Self> {
        (!self.is_empty()).then_some(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bootloader_type_display() {
        assert_eq!(BootloaderType::Grub2.to_string(), "grub2");
        assert_eq!(BootloaderType::SystemdBoot.to_string(), "systemd-boot");
        assert_eq!(BootloaderType::None.to_string(), "none");
        assert_eq!(BootloaderType::Grub2.as_ref(), "grub2");
        assert_eq!(BootloaderType::SystemdBoot.as_ref(), "systemd-boot");
        assert_eq!(BootloaderType::None.as_ref(), "none");
    }

    #[test]
    fn test_bootloader_type_serialization() {
        assert_eq!(
            serde_json::to_string(&BootloaderType::Grub2).unwrap(),
            "\"grub2\""
        );
        assert_eq!(
            serde_json::to_string(&BootloaderType::SystemdBoot).unwrap(),
            "\"systemd-boot\""
        );
        assert_eq!(
            serde_json::to_string(&BootloaderType::None).unwrap(),
            "\"none\""
        );
    }

    #[test]
    fn test_bootloader_type_deserialization() {
        assert_eq!(
            serde_json::from_str::<BootloaderType>("\"grub2\"").unwrap(),
            BootloaderType::Grub2
        );
        assert_eq!(
            serde_json::from_str::<BootloaderType>("\"systemd-boot\"").unwrap(),
            BootloaderType::SystemdBoot
        );
        assert_eq!(
            serde_json::from_str::<BootloaderType>("\"none\"").unwrap(),
            BootloaderType::None
        );
        assert!(serde_json::from_str::<BootloaderType>("\"invalid\"").is_err());
    }

    #[test]
    fn test_config_with_type() {
        let json = r#"{"type":"systemd-boot","timeout":5}"#;
        let config: Config = serde_json::from_str(json).unwrap();
        assert_eq!(config.r#type, Some(BootloaderType::SystemdBoot));
        assert_eq!(config.timeout, Some(5));

        let serialized = serde_json::to_value(&config).unwrap();
        assert_eq!(serialized["type"], "systemd-boot");
        assert_eq!(serialized["timeout"], 5);
        assert!(serialized.get("stopOnBootMenu").is_none());
    }

    #[test]
    fn test_to_option() {
        let empty = Config::default();
        assert!(empty.to_option().is_none());

        let with_timeout = Config {
            timeout: Some(5),
            ..Default::default()
        };
        assert_eq!(with_timeout.clone().to_option(), Some(with_timeout));

        let with_type = Config {
            r#type: Some(BootloaderType::None),
            ..Default::default()
        };
        assert!(with_type.to_option().is_some());
    }
}
