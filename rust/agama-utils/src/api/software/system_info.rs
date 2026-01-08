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

use serde::Serialize;

/// Software-related information of the system where the installer
/// is running.
#[derive(Clone, Debug, Default, Serialize, utoipa::ToSchema)]
pub struct SystemInfo {
    /// List of known patterns.
    pub patterns: Vec<Pattern>,
    /// List of known repositories.
    pub repositories: Vec<Repository>,
    /// Registration information
    pub registration: Option<RegistrationInfo>,
}

/// Repository specification.
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Repository {
    /// Repository alias. It has to be unique.
    pub alias: String,
    /// Repository name
    pub name: String,
    /// Repository URL (raw format without expanded variables)
    pub url: String,
    /// Whether the repository is enabled
    pub enabled: bool,
    /// Whether the repository is predefined (offline base repo, DUD repositories, etc.)
    pub predefined: bool,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct Pattern {
    /// Pattern name (eg., "aaa_base", "gnome")
    pub name: String,
    /// Pattern category (e.g., "Production")
    pub category: String,
    /// Pattern icon path locally on system
    pub icon: String,
    /// Pattern description
    pub description: String,
    /// Pattern summary
    pub summary: String,
    /// Pattern order
    pub order: String,
    /// Whether the pattern is selected by default
    pub preselected: bool,
}

#[derive(Clone, Default, Debug, Serialize, utoipa::ToSchema)]
pub struct RegistrationInfo {
    /// Registration code.
    pub code: Option<String>,
    /// Registration e-mail.
    pub email: Option<String>,
    /// URL of the registration server.
    pub url: Option<url::Url>,
    /// Available add-ons.
    pub addons: Vec<AddonInfo>,
}

/// Addon registration
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AddonInfo {
    /// Addon identifier
    pub id: String,
    /// Version of the addon
    pub version: String,
    /// User visible name
    pub label: String,
    /// Whether the addon is mirrored on the RMT server, on SCC it is always `true`
    pub available: bool,
    /// Whether a registration code is required for registering the addon
    pub free: bool,
    /// Whether the addon is recommended for the users
    pub recommended: bool,
    /// Short description of the addon (translated)
    pub description: String,
    /// Release status of the addon, e.g. "beta"
    pub release: String,
    /// Whether the addon is registered
    pub status: AddonStatus,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum AddonStatus {
    Registered { code: Option<String> },
    NotRegistered,
}
