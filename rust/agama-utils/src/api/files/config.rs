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
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::api::files::{
    file_source::resolve_url_field,
    scripts::{InitScript, PostPartitioningScript, PostScript, PreScript},
    user_file::UserFile,
    FileSourceError, WithFileSource,
};

/// Names of the "scripts" sub-keys that may contain file-bearing entries, matching
/// `ScriptsConfig`'s `#[serde(rename_all = "camelCase")]` field names.
const SCRIPT_KEYS: [&str; 4] = ["pre", "postPartitioning", "post", "init"];

/// Resolves relative URLs in the "files" and "scripts" sections of a raw JSON profile, leaving
/// every other key untouched (including keys this build doesn't recognize).
///
/// This is the JSON-only counterpart of [`Config::resolve_urls`], used by callers that must
/// treat the profile as opaque JSON instead of deserializing it into the typed `Config` (see
/// API-COMPATIBILITY-POLICY.md).
pub fn resolve_urls_in_value(
    profile: &mut Value,
    base_uri: &Uri<String>,
) -> Result<(), FileSourceError> {
    let Some(root) = profile.as_object_mut() else {
        return Ok(());
    };

    if let Some(files) = root.get_mut("files").and_then(Value::as_array_mut) {
        for file in files {
            resolve_url_field(file, base_uri)?;
        }
    }

    if let Some(scripts) = root.get_mut("scripts").and_then(Value::as_object_mut) {
        for key in SCRIPT_KEYS {
            if let Some(list) = scripts.get_mut(key).and_then(Value::as_array_mut) {
                for script in list {
                    resolve_url_field(script, base_uri)?;
                }
            }
        }
    }

    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema)]
#[schemars(rename = "files.Config")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub files: Option<Vec<UserFile>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub scripts: Option<ScriptsConfig>,
}

impl Config {
    pub fn resolve_urls(&mut self, base_uri: &Uri<String>) -> Result<(), FileSourceError> {
        resolve_urls_for(&mut self.files, base_uri)?;

        if let Some(scripts) = &mut self.scripts {
            scripts.resolve_urls(base_uri)?;
        }

        Ok(())
    }
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, Merge, JsonSchema, PartialEq)]
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
        resolve_urls_for(&mut self.pre, base_uri)?;
        resolve_urls_for(&mut self.post_partitioning, base_uri)?;
        resolve_urls_for(&mut self.post, base_uri)?;
        resolve_urls_for(&mut self.init, base_uri)?;
        Ok(())
    }
}

fn resolve_urls_for<T: WithFileSource>(
    files: &mut Option<Vec<T>>,
    base_uri: &Uri<String>,
) -> Result<(), FileSourceError> {
    if let Some(ref mut files) = files {
        for file in files {
            file.resolve_url(base_uri)?;
        }
    }
    Ok(())
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
        let script = pre_scripts.first().unwrap();
        assert_eq!(&script.base.name, "updated");
    }

    #[test]
    fn test_merge_files_config() {
        let mut updated = Config {
            files: Some(vec![UserFile {
                destination: "/foo".to_string(),
                ..Default::default()
            }]),
            scripts: Some(ScriptsConfig {
                pre: Some(vec![build_pre_script("updated_pre")]),
                ..Default::default()
            }),
        };

        let original = Config {
            files: Some(vec![UserFile {
                destination: "/bar".to_string(),
                ..Default::default()
            }]),
            scripts: Some(ScriptsConfig {
                pre: Some(vec![build_pre_script("original_pre")]),
                post: Some(vec![]),
                ..Default::default()
            }),
        };

        let updated_clone = updated.clone();
        updated.merge(original);

        // Assert for files (overwrite_none)
        // `updated.files` is Some, so it is not overwritten.
        assert_eq!(updated.files, updated_clone.files);

        // Assert for scripts (overwrite_none on Option<ScriptsConfig>)
        // `updated.scripts` is Some, so it is not overwritten.
        assert_eq!(updated.scripts, updated_clone.scripts);
        // The inner fields of `updated.scripts` should not have changed.
        assert!(updated.scripts.as_ref().unwrap().post.is_none());
    }

    fn base_uri() -> Uri<String> {
        Uri::parse("http://example.lan/profiles/")
            .unwrap()
            .to_owned()
    }

    #[test]
    fn test_resolve_urls_in_value_resolves_relative_file_url() {
        let mut profile = serde_json::json!({
            "files": [
                { "url": "file.txt", "destination": "/etc/foo" }
            ]
        });

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(
            profile["files"][0]["url"],
            "http://example.lan/profiles/file.txt"
        );
        assert_eq!(profile["files"][0]["destination"], "/etc/foo");
    }

    #[test]
    fn test_resolve_urls_in_value_leaves_absolute_url_untouched() {
        let mut profile = serde_json::json!({
            "files": [
                { "url": "http://other.lan/file.txt", "destination": "/etc/foo" }
            ]
        });

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(profile["files"][0]["url"], "http://other.lan/file.txt");
    }

    #[test]
    fn test_resolve_urls_in_value_leaves_content_entries_untouched() {
        let mut profile = serde_json::json!({
            "files": [
                { "content": "hello", "destination": "/etc/foo" }
            ]
        });
        let original = profile.clone();

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(profile, original);
    }

    #[test]
    fn test_resolve_urls_in_value_resolves_scripts() {
        let mut profile = serde_json::json!({
            "scripts": {
                "pre": [{ "name": "pre", "url": "pre.sh" }],
                "postPartitioning": [{ "name": "pp", "url": "pp.sh" }],
                "post": [{ "name": "post", "url": "post.sh" }],
                "init": [{ "name": "init", "url": "init.sh" }],
            }
        });

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(
            profile["scripts"]["pre"][0]["url"],
            "http://example.lan/profiles/pre.sh"
        );
        assert_eq!(
            profile["scripts"]["postPartitioning"][0]["url"],
            "http://example.lan/profiles/pp.sh"
        );
        assert_eq!(
            profile["scripts"]["post"][0]["url"],
            "http://example.lan/profiles/post.sh"
        );
        assert_eq!(
            profile["scripts"]["init"][0]["url"],
            "http://example.lan/profiles/init.sh"
        );
    }

    #[test]
    fn test_resolve_urls_in_value_preserves_unknown_fields() {
        let mut profile = serde_json::json!({
            "files": [
                { "url": "file.txt", "destination": "/etc/foo" }
            ],
            "someFutureField": { "nested": "value" }
        });

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(profile["someFutureField"]["nested"], "value");
    }

    #[test]
    fn test_resolve_urls_in_value_without_files_or_scripts_is_a_noop() {
        let mut profile = serde_json::json!({ "hostname": { "static": "test" } });
        let original = profile.clone();

        resolve_urls_in_value(&mut profile, &base_uri()).unwrap();

        assert_eq!(profile, original);
    }

    #[test]
    fn test_resolve_urls_in_value_fails_on_invalid_url() {
        let mut profile = serde_json::json!({
            "files": [
                { "url": "http://%zz", "destination": "/etc/foo" }
            ]
        });

        let result = resolve_urls_in_value(&mut profile, &base_uri());

        assert!(matches!(result, Err(FileSourceError::InvalidUrl(_, _))));
    }
}
