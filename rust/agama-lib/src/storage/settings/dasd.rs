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

//! Representation of the DASD settings used in set/get config

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DASDConfig {
    pub devices: Vec<DASDDeviceConfig>,
}

#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum DASDDeviceState {
    #[default]
    Active,
    Offline,
}

/// Representation of single DASD device in settings used in set/get config
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DASDDeviceConfig {
    /// DASD device Channel. Mandatory part of device config.
    pub channel: String,
    /// State of device. Optional, if missing then default is active.
    pub state: Option<DASDDeviceState>,
    /// explicit request to format device. If missing then it will format only if not already formatted.
    /// false means never format.
    pub format: Option<bool>,
    /// Set diag flag for device. If missing, then do not change what device already has set.
    pub diag: Option<bool>,
}
