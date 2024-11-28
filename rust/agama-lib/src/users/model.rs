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

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootConfig {
    /// returns if password for root is set or not
    pub password: bool,
    /// empty string mean no sshkey is specified
    pub sshkey: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootPatchSettings {
    /// empty string here means remove ssh key for root
    pub sshkey: Option<String>,
    /// empty string here means remove password for root
    pub password: Option<String>,
    /// specify if patched password is provided in encrypted form
    pub encrypted_password: Option<bool>,
}
