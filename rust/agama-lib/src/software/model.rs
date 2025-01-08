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
use std::collections::HashMap;

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SoftwareConfig {
    /// A map where the keys are the pattern names and the values whether to install them or not.
    pub patterns: Option<HashMap<String, bool>>,
    /// Name of the product to install.
    pub product: Option<String>,
}

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationParams {
    /// Registration key.
    pub key: String,
    /// Registration email.
    pub email: String,
}

/// Information about registration configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationInfo {
    /// Registration key. Empty value mean key not used or not registered.
    pub key: String,
    /// Registration email. Empty value mean email not used or not registered.
    pub email: String,
}

#[derive(
    Clone,
    Default,
    Debug,
    Serialize,
    Deserialize,
    strum::Display,
    strum::EnumString,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum RegistrationRequirement {
    /// Product does not require registration
    #[default]
    No = 0,
    /// Product has optional registration
    Optional = 1,
    /// It is mandatory to register the product
    Mandatory = 2,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationError {
    /// ID of error. See dbus API for possible values
    pub id: u32,
    /// human readable error string intended to be displayed to user
    pub message: String,
}

/// Software resolvable type (package or pattern).
#[derive(Deserialize, Serialize, strum::Display, utoipa::ToSchema)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ResolvableType {
    Package = 0,
    Pattern = 1,
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
