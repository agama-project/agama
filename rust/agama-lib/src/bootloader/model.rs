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

//! Implements a data model for Bootloader configuration.

use serde::{Deserialize, Serialize};

/// Represents a Bootloader
#[derive(Clone, Debug, Serialize, Deserialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BootloaderSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop_on_boot_menu: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timeout: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_kernel_params: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update_nvram: Option<bool>,
}

impl BootloaderSettings {
    pub fn to_option(self) -> Option<Self> {
        if self.stop_on_boot_menu.is_none()
            && self.timeout.is_none()
            && self.extra_kernel_params.is_none()
            && self.update_nvram.is_none()
        {
            None
        } else {
            Some(self)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_to_option() {
        let settings = BootloaderSettings::default();
        assert!(settings.to_option().is_none());

        let settings = BootloaderSettings {
            update_nvram: Some(false),
            ..Default::default()
        };
        assert!(settings.to_option().is_some());
    }

    #[test]
    fn test_deserialize_update_nvram() {
        let json = r#"{"updateNvram":false}"#;
        let settings: BootloaderSettings = serde_json::from_str(json).unwrap();
        assert_eq!(settings.update_nvram, Some(false));
    }
}
