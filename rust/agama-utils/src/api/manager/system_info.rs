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

use crate::api::manager::License;
use serde::Serialize;

/// Global information of the system where the installer is running.
#[derive(Clone, Debug, Default, Serialize, utoipa::ToSchema)]
pub struct SystemInfo {
    /// List of known products.
    pub products: Vec<Product>,
    /// List of known licenses
    pub licenses: Vec<License>,
    /// Hardware information
    pub hardware: HardwareInfo,
}

/// Represents a software product
#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    /// Product ID (eg., "ALP", "Tumbleweed", etc.)
    pub id: String,
    /// Product name (e.g., "openSUSE Tumbleweed")
    pub name: String,
    /// Product description
    pub description: String,
    /// Product icon (e.g., "default.svg")
    pub icon: String,
    /// Registration requirement
    pub registration: bool,
    /// License ID
    pub license: Option<String>,
}

/// Represents the hardware information of the underlying system.
#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
pub struct HardwareInfo {
    /// CPU description.
    pub cpu: Option<String>,
    /// Memory size (in bytes).
    pub memory: Option<u64>,
    /// Computer model.
    pub model: Option<String>,
}
