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

//! This module defines some ancillary types for the HTTP API.

use std::collections::HashMap;

use agama_utils::issue;
use serde::Serialize;

#[derive(Serialize, utoipa::ToSchema)]
/// Holds the installation issues for each scope.
pub struct IssuesMap {
    /// iSCSI issues.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub iscsi: Vec<issue::Issue>,
    /// Localization issues.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub localization: Vec<issue::Issue>,
    /// Product related issues (product selection, registration, etc.).
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub product: Vec<issue::Issue>,
    /// Storage related issues.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub storage: Vec<issue::Issue>,
    /// Software management issues.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub software: Vec<issue::Issue>,
    /// First user and authentication issues.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub users: Vec<issue::Issue>,
}

impl From<HashMap<String, Vec<issue::Issue>>> for IssuesMap {
    fn from(mut value: HashMap<String, Vec<issue::Issue>>) -> Self {
        Self {
            iscsi: value.remove("iscsi").unwrap_or_default(),
            localization: value.remove("localization").unwrap_or_default(),
            product: value.remove("product").unwrap_or_default(),
            software: value.remove("software").unwrap_or_default(),
            storage: value.remove("storage").unwrap_or_default(),
            users: value.remove("users").unwrap_or_default(),
        }
    }
}
