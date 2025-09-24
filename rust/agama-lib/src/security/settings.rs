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

//! Representation of the software settings

use serde::{Deserialize, Serialize};

use super::model::SSLFingerprint;

/// Security settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SecuritySettings {
    /// List of user selected patterns to install.
    #[serde(skip_serializing_if = "Option::is_none")]
    // when we add support for remote URL here it should be vector of SSL
    // certificates which will include flatten fingerprint
    pub ssl_certificates: Option<Vec<SSLFingerprint>>,
}

impl SecuritySettings {
    pub fn to_option(self) -> Option<Self> {
        if self.ssl_certificates.is_none() {
            None
        } else {
            Some(self)
        }
    }
}
