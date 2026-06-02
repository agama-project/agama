// Copyright (c) [2026] SUSE LLC
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
//! Implements a data model for Bootloader configuration.

use merge::Merge;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// Allows to specify explicit enablement of remote access for supported services
#[derive(Default, Clone, Copy, Debug, Serialize, Deserialize, PartialEq, JsonSchema)]
#[serde(rename_all = "camelCase")]
pub enum AccessValue {
    /// Explicitly enabled
    Enabled,
    /// Default system configuration behavior that is product specific
    #[default]
    Default,
}

/// Remote Access configuration
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "access.Config")]
pub struct Config {
    /// Remote access to SSH
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub ssh: Option<AccessValue>,
    /// Remote access to Web Console
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub web_console: Option<AccessValue>,
}

/// Remote Access extended configuration that is resolved
#[derive(Clone, Debug, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "camelCase")]
#[schemars(rename = "access.ExtendedConfig")]
pub struct ExtendedConfig {
    /// Remote access to SSH
    pub ssh: AccessValue,
    /// Remote access to Web Console
    pub web_console: AccessValue,
}
