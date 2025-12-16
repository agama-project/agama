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
use merge::Merge;
use serde::{Deserialize, Serialize};

use crate::api::files::{
    scripts::{InitScript, PostPartitioningScript, PostScript, PreScript},
    user_file::UserFile,
    FileSourceError, WithFileSource,
};

#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
pub struct Config {
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[merge(strategy = merge::vec::overwrite_empty)]
    pub files: Vec<UserFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub scripts: Option<ScriptsConfig>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::overwrite_none)]
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

#[cfg(test)]
mod tests {
    use crate::api::files::{BaseScript, FileSource};

    use super::*;

    fn base_script(name: &str) -> BaseScript {
        BaseScript {
            name: name.to_string(),
            source: FileSource::Text {
                content: "".to_string(),
            },
        }
    }

    fn build_pre_script(name: &str) -> PreScript {
        PreScript {
            base: base_script(name),
        }
    }

    #[test]
    fn test_merge_with_default_scripts() {
        let mut new_config = ScriptsConfig {
            pre: Some(vec![build_pre_script("test")]),
            ..Default::default()
        };
        new_config.merge(Default::default());

        let pre_scripts = new_config.pre.unwrap();
        assert_eq!(pre_scripts.len(), 1);
    }

    #[test]
    fn test_merge_scripts() {
        let original = ScriptsConfig {
            pre: Some(vec![build_pre_script("test")]),
            ..Default::default()
        };

        let mut updated = ScriptsConfig {
            pre: Some(vec![build_pre_script("updated")]),
            ..Default::default()
        };

        updated.merge(original);
        let pre_scripts = updated.pre.unwrap();
        assert_eq!(pre_scripts.len(), 1);
        let script = pre_scripts.get(0).unwrap();
        assert_eq!(&script.base.name, "updated");
    }
}
