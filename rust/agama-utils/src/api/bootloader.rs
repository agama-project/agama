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
use serde::{Deserialize, Serialize};

/// Bootloader configuration.
#[derive(Clone, Debug, Serialize, Deserialize, Default, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
pub struct Config {
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
