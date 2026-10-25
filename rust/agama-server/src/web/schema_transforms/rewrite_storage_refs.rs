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

use super::utils::capitalize;
use schemars::transform::{transform_subschemas, Transform};
use schemars::Schema;
use serde_json::Value;

const STORAGE_DEVICE_FILE: &str = "device.storage.schema.json";
const STORAGE_DEVICE_DEFS_PREFIX: &str = "device.storage.schema.json#/$defs/";
const STORAGE_DEVICE_COMPONENT_PREFIX: &str = "#/components/schemas/StorageDevice";

/// A schemars [`Transform`] that rewrites external references to `device.storage.schema.json` into
/// global OpenAPI component paths (`#/components/schemas/StorageDevice...`).
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct RewriteStorageRefs;

impl Transform for RewriteStorageRefs {
    fn transform(&mut self, schema: &mut Schema) {
        transform_subschemas(self, schema);

        let Some(map) = schema.as_object_mut() else {
            return;
        };

        let Some(Value::String(ref_str)) = map.get_mut("$ref") else {
            return;
        };

        if ref_str == STORAGE_DEVICE_FILE {
            *ref_str = STORAGE_DEVICE_COMPONENT_PREFIX.to_string();
        } else if let Some(def_name) = ref_str.strip_prefix(STORAGE_DEVICE_DEFS_PREFIX) {
            *ref_str = format!(
                "{}{}",
                STORAGE_DEVICE_COMPONENT_PREFIX,
                capitalize(def_name)
            );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rewrite_storage_refs() {
        let mut schema: Schema = serde_json::from_value(serde_json::json!({
            "type": "object",
            "properties": {
                "device": {
                    "$ref": "device.storage.schema.json"
                },
                "partition": {
                    "$ref": "device.storage.schema.json#/$defs/partition"
                }
            }
        }))
        .unwrap();

        let mut transform = RewriteStorageRefs;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();
        assert_eq!(
            props.get("device").and_then(|d| d.get("$ref")),
            Some(&Value::String(
                "#/components/schemas/StorageDevice".to_string()
            ))
        );
        assert_eq!(
            props.get("partition").and_then(|d| d.get("$ref")),
            Some(&Value::String(
                "#/components/schemas/StorageDevicePartition".to_string()
            ))
        );
    }
}
