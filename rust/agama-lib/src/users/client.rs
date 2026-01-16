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

//! Implements a client to access Agama's users service.

use super::FirstUserSettings;
use crate::error::ServiceError;
use serde::{Deserialize, Serialize};
use zbus::Connection;

/// Represents the settings for the first user
#[derive(Serialize, Deserialize, Clone, Debug, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FirstUser {
    /// First user's full name
    pub full_name: String,
    /// First user's username
    pub user_name: String,
    /// First user's password (in clear text)
    pub password: String,
    /// Whether the password is hashed (true) or is plain text (false)
    pub hashed_password: bool,
}

/// Represents the settings for the first user
#[derive(Serialize, Deserialize, Clone, Debug, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootUser {
    /// Root user password
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Whether the password is hashed (true) or is plain text (false or None)
    pub hashed_password: Option<bool>,
    /// SSH public key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_public_key: Option<String>,
}
