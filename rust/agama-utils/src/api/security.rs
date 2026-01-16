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
use serde::{Deserialize, Serialize};

/// Security settings for installation
#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// List of user selected patterns to install.
    #[serde(skip_serializing_if = "Option::is_none")]
    // when we add support for remote URL here it should be vector of SSL
    // certificates which will include flatten fingerprint
    #[merge(strategy = merge::option::overwrite_none)]
    pub ssl_certificates: Option<Vec<SSLFingerprint>>,
}

#[derive(
    Default,
    Clone,
    Copy,
    Debug,
    strum::IntoStaticStr,
    strum::EnumString,
    Serialize,
    Deserialize,
    utoipa::ToSchema,
)]
#[strum(ascii_case_insensitive)]
// #[strum(
//   parse_err_fn = alg_not_found_err,
//   parse_err_ty = ServiceError,
// )]
pub enum SSLFingerprintAlgorithm {
    SHA1,
    #[default]
    SHA256,
}

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SSLFingerprint {
    /// The string value for SSL certificate fingerprint.
    /// Example value is "F6:7A:ED:BB:BC:94:CF:55:9D:B3:BA:74:7A:87:05:EF:67:4E:C2:DB"
    pub fingerprint: String,
    /// Algorithm used to compute SSL certificate fingerprint.
    /// Supported options are "SHA1" and "SHA256"
    #[serde(default)]
    pub algorithm: SSLFingerprintAlgorithm,
}

// fn alg_not_found_err(s: &str) -> ServiceError {
//     ServiceError::UnsupportedSSLFingerprintAlgorithm(s.to_string())
// }
