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

use std::fmt;

use serde::Serialize;
use serde_with::skip_serializing_none;

/// Software-related information of the system where the installer
/// is running.
#[skip_serializing_none]
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

#[skip_serializing_none]
#[derive(Clone, Default, Serialize, utoipa::ToSchema)]
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

impl fmt::Debug for RegistrationInfo {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("RegistrationInfo")
            .field("code", &self.code.as_ref().map(|_| "[FILTERED]"))
            .field("email", &self.email)
            .field("url", &self.url)
            .field("addons", &self.addons)
            .finish()
    }
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
    pub registration: AddonRegistration,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "status")]
pub enum AddonRegistration {
    Registered { code: Option<String> },
    NotRegistered,
}

#[cfg(test)]
mod tests {
    use super::RegistrationInfo;

    #[test]
    fn test_registration_info_debug() {
        let state = RegistrationInfo {
            code: Some("secret_code".to_string()),
            email: Some("me@example.org".to_string()),
            url: None,
            addons: vec![],
        };

        let debug_output = format!("{:?}", state);
        assert!(debug_output.contains("code: Some(\"[FILTERED]\")"));
        assert!(!debug_output.contains("secret_code"));

        let state_no_code = RegistrationInfo {
            code: None,
            email: None,
            url: None,
            addons: vec![],
        };
        let debug_output_no_code = format!("{:?}", state_no_code);
        assert!(debug_output_no_code.contains("code: None"));
    }
}
