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

use serde::{Deserialize, Serialize};

/// Represents a software resolvable.
#[derive(Clone, Debug, Deserialize, PartialEq, utoipa::ToSchema)]
pub struct Resolvable {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: ResolvableType,
}

impl Resolvable {
    pub fn new(name: &str, r#type: ResolvableType) -> Self {
        Self {
            name: name.to_string(),
            r#type,
        }
    }
}

/// Software resolvable type (package or pattern).
#[derive(
    Clone, Copy, Debug, Deserialize, Serialize, strum::Display, utoipa::ToSchema, PartialEq,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ResolvableType {
    Package = 0,
    Pattern = 1,
    Product = 2,
}

impl From<ResolvableType> for zypp_agama::ResolvableKind {
    fn from(value: ResolvableType) -> Self {
        match value {
            ResolvableType::Package => zypp_agama::ResolvableKind::Package,
            ResolvableType::Product => zypp_agama::ResolvableKind::Product,
            ResolvableType::Pattern => zypp_agama::ResolvableKind::Pattern,
        }
    }
}

/// Resolvable list specification.
#[derive(Deserialize, Serialize, utoipa::ToSchema)]
pub struct ResolvableParams {
    /// List of resolvables.
    pub names: Vec<String>,
    /// Resolvable type.
    pub r#type: ResolvableType,
    /// Whether the resolvables are optional or not.
    pub optional: bool,
}
