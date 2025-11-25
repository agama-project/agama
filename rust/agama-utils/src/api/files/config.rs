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
use serde::{Deserialize, Serialize};

use crate::api::files::{
    scripts::{InitScript, PostPartitioningScript, PostScript, PreScript},
    user_file::UserFile,
    FileSourceError, WithFileSource,
};

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub files: Option<FilesConfig>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FilesConfig {
    /// list of target files to deploy
    pub files: Vec<UserFile>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScriptsConfig {
    /// User-defined pre-installation scripts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pre: Option<Vec<PreScript>>,
    /// User-defined post-partitioning scripts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post_partitioning: Option<Vec<PostPartitioningScript>>,
    /// User-defined post-installation scripts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub post: Option<Vec<PostScript>>,
    /// User-defined init scripts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub init: Option<Vec<InitScript>>,
}

impl ScriptsConfig {
    pub fn to_option(self) -> Option<Self> {
        if self.pre.is_none()
            && self.post_partitioning.is_none()
            && self.post.is_none()
            && self.init.is_none()
        {
            None
        } else {
            Some(self)
        }
    }

    /// Resolve relative URLs in the scripts.
    ///
    /// * `base_uri`: The base URI to resolve relative URLs against.
    pub fn resolve_urls(&mut self, base_uri: &Uri<String>) -> Result<(), FileSourceError> {
        Self::resolve_urls_for(&mut self.pre, base_uri)?;
        Self::resolve_urls_for(&mut self.post_partitioning, base_uri)?;
        Self::resolve_urls_for(&mut self.post, base_uri)?;
        Self::resolve_urls_for(&mut self.init, base_uri)?;
        Ok(())
    }

    fn resolve_urls_for<T: WithFileSource>(
        scripts: &mut Option<Vec<T>>,
        base_uri: &Uri<String>,
    ) -> Result<(), FileSourceError> {
        if let Some(ref mut scripts) = scripts {
            for script in scripts {
                script.resolve_url(&base_uri)?;
            }
        }
        Ok(())
    }
}
