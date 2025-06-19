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

use fluent_uri::Uri;
use std::path::Path;

#[derive(Debug, thiserror::Error)]
#[error("Could not determine the installation context")]
pub struct InstallationContextError(String);

/// It contains context information for the store.
#[derive(Debug)]
pub struct InstallationContext {
    /// Where the installation settings are from.
    /// Used for resolving relative URL references.
    pub source: Uri<String>,
}

impl InstallationContext {
    /// Sets _source_ to the current directory.
    pub fn from_env() -> Result<Self, InstallationContextError> {
        let current_path =
            std::env::current_dir().map_err(|e| InstallationContextError(e.to_string()))?;
        let url = format!("file://{}/", current_path.display());
        Self::from_url_str(&url)
    }

    pub fn from_url_str(url_str: &str) -> Result<Self, InstallationContextError> {
        let url = Uri::parse(url_str).map_err(|e| InstallationContextError(e.to_string()))?;
        Ok(Self {
            source: url.to_owned(),
        })
    }

    pub fn from_file(path: &Path) -> Result<Self, InstallationContextError> {
        let canon_path = path
            .canonicalize()
            .map_err(|e| InstallationContextError(e.to_string()))?;
        let url = format!("file://{}", canon_path.display());
        Self::from_url_str(&url)
    }
}
