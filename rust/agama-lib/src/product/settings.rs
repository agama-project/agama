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

//! Representation of the product settings

use serde::{Deserialize, Serialize};

/// Addon settings for registration
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AddonSettings {
    pub id: String,
    /// Optional version of the addon, if not specified the version is found
    /// from the available addons
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    /// Free extensions do not require a registration code
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_code: Option<String>,
}

/// Software settings for installation
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProductSettings {
    /// ID of the product to install (e.g., "ALP", "Tumbleweed", etc.)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub registration_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub addons: Option<Vec<AddonSettings>>,
}
