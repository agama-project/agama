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

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationParams {
    /// Registration key.
    pub key: String,
    /// Registration email.
    pub email: String,
}

/// Addon registration
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddonParams {
    // Addon identifier
    pub id: String,
    // Addon version, the same addon might be available in multiple versions
    pub version: String,
    // Optional registration code, not required for free extensions
    pub registration_code: Option<String>,
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

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationError {
    /// ID of error. See dbus API for possible values
    pub id: u32,
    /// human readable error string intended to be displayed to user
    pub message: String,
}
