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

//! Implements a data model for Files configuration.

use serde::{Deserialize, Serialize};
use std::process;
use std::fs::OpenOptions;
use std::os::unix::fs::OpenOptionsExt;
use std::io::Write;

use crate::utils::Transfer;

use super::error::FileError;

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
    #[serde(default = "FileSettings::default_permissions")]
    pub permissions: String, // TODO: better type?
    /// User owning the file
    #[serde(default = "FileSettings::default_user")]
    pub user: String,
    /// Group owning the file
    #[serde(default = "FileSettings::default_group")]
    pub group: String,
    /// destination for file like "/etc/config.d/my.conf"
    pub destination: String
}

impl FileSettings {
    fn default_permissions() -> String {
        "0644".to_string()
    }

    fn default_user() -> String {
        "root".to_string()
    }

    fn default_group() -> String {
        "root".to_string()
    }
}

impl Default for FileSettings {
    fn default() -> Self {
        Self { 
            source: FileSource::Text { content: "".to_string() },
            permissions: Self::default_permissions(),
            user: Self::default_user(),
            group: Self::default_group(),
            destination: "/dev/null".to_string() // should be always defined
        }
    }
}

impl FileSettings {
    pub async fn write(&self) -> Result<(), FileError> {
        let int_mode = u32::from_str_radix(&self.permissions, 8)?;
        let path = "/mnt".to_string() + &self.destination;
        // cannot set owner here as user and group can exist only on target destination
        let mut target = OpenOptions::new().mode(int_mode).write(true).create(true).open(path)?;
        match &self.source {
            FileSource::Remote {url} => { Transfer::get(url, &mut target)?; }
            FileSource::Text { content } => { target.write(content.as_bytes())?; }
        }
        
        // so lets set user and group afterwards..it should not be security issue as original owner is root so it basically just reduce restriction
        process::Command::new("chroot").args(["/mnt", "chown", format!("{}:{}", &self.user, &self.group).as_str()]).output()?;
        Ok(())
    }
}
