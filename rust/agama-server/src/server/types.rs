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

use agama_lib::install_settings::InstallSettings;
use agama_utils::api::Scope;
use agama_utils::issue;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize, utoipa::ToSchema)]
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

impl From<HashMap<Scope, Vec<issue::Issue>>> for IssuesMap {
    fn from(mut value: HashMap<Scope, Vec<issue::Issue>>) -> Self {
        Self {
            iscsi: value.remove(&Scope::Iscsi).unwrap_or_default(),
            localization: value.remove(&Scope::L10n).unwrap_or_default(),
            product: value.remove(&Scope::Product).unwrap_or_default(),
            software: value.remove(&Scope::Software).unwrap_or_default(),
            storage: value.remove(&Scope::Storage).unwrap_or_default(),
            users: value.remove(&Scope::Users).unwrap_or_default(),
        }
    }
}

#[derive(Deserialize, Serialize, utoipa::ToSchema)]
/// Patch for the config.
pub struct ConfigPatch {
    /// Update for the current config.
    pub update: Option<InstallSettings>,
}
