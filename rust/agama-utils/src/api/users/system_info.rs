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

use gettextrs::*;
use serde::ser::SerializeStruct;
use serde::Serialize;
use serde::Deserialize;
use serde_with::{serde_as, DisplayFromStr};
use crate::api::users::UserInfo;

#[serde_as]
#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
pub struct SystemInfo {
    /// List of know users.
    pub users: Vec<UserInfo>,
}
