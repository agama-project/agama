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

//! Implements a data model for Hostname configuration.

use serde::{Deserialize, Serialize};

/// Represents a Hostname
#[derive(Clone, Debug, Serialize, Deserialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct HostnameSettings {
    #[serde(rename = "transient", skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    // empty string means removing the static hostname
    #[serde(rename = "static", skip_serializing_if = "Option::is_none")]
    pub static_hostname: Option<String>,
}
