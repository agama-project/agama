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

use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub storage: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_autoyast_storage: Option<Value>,
}

impl Config {
    pub fn has_value(&self) -> bool {
        self.storage.is_some() || self.legacy_autoyast_storage.is_some()
    }
}

impl Merge for Config {
    fn merge(&mut self, other: Self) {
        if let Some(storage) = &mut self.storage {
            if let Some(other_storage) = other.storage {
                merge_values_as_objects(storage, other_storage);
            }
        } else {
            self.storage = other.storage;
        }

        // No need to merge both values because it is just an array of drives.
        if self.legacy_autoyast_storage.is_none() {
            self.legacy_autoyast_storage = other.legacy_autoyast_storage;
        }
    }
}

// Merge to serde_json::Value structs.
//
// Both Value structs are supposed to represent JSON objects.
fn merge_values_as_objects(left: &mut Value, right: Value) {
    let Value::Object(left_object) = left else {
        return;
    };

    let Value::Object(right_object) = right else {
        return;
    };

    for (k, v) in right_object {
        left_object.entry(k).or_insert(v);
    }
}

#[cfg(test)]
mod tests {
    use merge::Merge;

    use super::*;

    #[test]
    fn test_merge_with_default_config() {
        let mut config: Config = serde_json::from_str(r#"{ "storage": { "drives": [] }}"#).unwrap();
        let original = Config::default();

        config.merge(original);
        assert!(config.storage.is_some());
    }

    #[test]
    fn test_merge_storage_key() {
        let mut config: Config = serde_json::from_str(r#"{ "storage": { "drives": [] }}"#).unwrap();
        let original: Config = serde_json::from_str(r#"{ "storage": { "mdRaids": [] }}"#).unwrap();

        config.merge(original);
        let value = config.storage.unwrap();
        assert!(value.get("drives").is_some());
        assert!(value.get("mdRaids").is_some());
    }

    #[test]
    fn test_merge_with_no_storage() {
        let mut config = Config::default();
        let original: Config = serde_json::from_str(r#"{ "storage": { "drives": [] }}"#).unwrap();

        config.merge(original);
        assert!(config.storage.is_some());
    }
}
