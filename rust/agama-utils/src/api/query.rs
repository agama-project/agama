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

use serde::{de::Error, Deserialize, Deserializer};
use serde_json::Value;

#[derive(Deserialize, utoipa::IntoParams, utoipa::ToSchema)]
pub struct SolveStorageModel {
    #[serde(deserialize_with = "deserialize_model")]
    pub model: Value,
}

fn deserialize_model<'de, D>(deserializer: D) -> Result<Value, D::Error>
where
    D: Deserializer<'de>,
{
    let json_string: String = String::deserialize(deserializer)?;
    serde_json::from_str(&json_string).map_err(D::Error::custom)
}
