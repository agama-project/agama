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

//! Representation of the zFCP settings used in set/get config

use serde::{Deserialize, Serialize};

#[derive(Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ZFCPConfig {
    pub devices: Vec<ZFCPDeviceConfig>,
}

/// Representation of single zFCP device in settings used in set/get config
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ZFCPDeviceConfig {
    /// zFCP controller channel id (e.g., 0.0.fa00)
    pub channel: String,
    /// WWPN of the targer port (e.g., 0x500507630300c562)
    pub wwpn: String,
    /// LUN of the SCSI device (e.g. 0x4010403300000000)
    pub lun: String,
}
