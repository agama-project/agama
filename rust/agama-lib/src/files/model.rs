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

//! Implements a data model for Files configuration.

use serde::{Deserialize, Serialize};

use crate::error::ServiceError;

#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(untagged)]
pub enum FileSource {
    /// File body directly written
    Text { content: String },
    /// URL to get the file from.
    Remote { url: String },
}

/// Represents individual settings for single file deployment
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FileSettings {
    #[serde(flatten)]
    pub source: FileSource,
    /// Permissions for file
    pub permissions: String, // TODO: better type?
    /// pair with owner user and group
    pub owner: (String,String), // in format of user,group
    /// destination for file like "/etc/config.d/my.conf"
    pub destination: String
}

impl Default for FileSettings {
    fn default() -> Self {
        Self { 
            source: FileSource::Text { content: "".to_string() },
            permissions: "0644".to_string(),
            owner: ("root".to_string(), "root".to_string()),
            destination: "/dev/null".to_string() // should be always defined
        }
    }
}

impl FileSettings {
    pub fn write(&self) -> Result<(), ServiceError> {
        // TODO: implement
        Ok(())
    }
}
