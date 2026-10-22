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

use schemars::transform::{transform_subschemas, Transform};
use schemars::Schema;
use serde_json::Value;

/// A schemars [`Transform`] that sets `"additionalProperties": false` on all object schemas
/// that do not already define `additionalProperties`.
///
/// This ensures schema validators reject unexpected keys. Map types (such as `HashMap<String, V>`)
/// that already specify a schema for `additionalProperties` are preserved without change.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct DenyAdditionalProperties;

impl Transform for DenyAdditionalProperties {
    fn transform(&mut self, schema: &mut Schema) {
        if let Some(map) = schema.as_object_mut() {
            let is_object = if let Some(type_val) = map.get("type") {
                match type_val {
                    Value::String(s) => s == "object",
                    Value::Array(arr) => arr.iter().any(|v| v.as_str() == Some("object")),
                    _ => false,
                }
            } else {
                map.contains_key("properties") || map.contains_key("patternProperties")
            };

            if is_object && !map.contains_key("additionalProperties") && !map.contains_key("anyOf")
            {
                map.insert("additionalProperties".to_string(), Value::Bool(false));
            }
        }

        transform_subschemas(self, schema);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};
    use std::collections::HashMap;

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct SimpleUser {
        name: String,
        age: u32,
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct NestedContainer {
        user: SimpleUser,
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct MapContainer {
        data: HashMap<String, String>,
    }

    #[test]
    fn test_deny_additional_properties_simple_object() {
        let mut schema = schemars::schema_for!(SimpleUser);
        assert!(schema
            .as_object()
            .unwrap()
            .get("additionalProperties")
            .is_none());

        let mut transform = DenyAdditionalProperties;
        transform.transform(&mut schema);

        assert_eq!(
            schema.as_object().unwrap().get("additionalProperties"),
            Some(&Value::Bool(false))
        );
    }

    #[test]
    fn test_deny_additional_properties_nested_object() {
        let mut schema = schemars::schema_for!(NestedContainer);
        let mut transform = DenyAdditionalProperties;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert_eq!(obj.get("additionalProperties"), Some(&Value::Bool(false)));

        // Nested subschema in $defs should also have additionalProperties: false
        if let Some(defs) = obj.get("$defs").and_then(|d| d.as_object()) {
            if let Some(user_def) = defs.get("SimpleUser").and_then(|u| u.as_object()) {
                assert_eq!(
                    user_def.get("additionalProperties"),
                    Some(&Value::Bool(false))
                );
            }
        }
    }

    #[test]
    fn test_preserve_map_additional_properties() {
        let mut schema = schemars::schema_for!(MapContainer);
        let mut transform = DenyAdditionalProperties;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert_eq!(obj.get("additionalProperties"), Some(&Value::Bool(false)));

        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();
        let data_prop = props.get("data").and_then(|d| d.as_object()).unwrap();
        // The data map should preserve its schema for additionalProperties, NOT set to false
        assert_ne!(
            data_prop.get("additionalProperties"),
            Some(&Value::Bool(false))
        );
        assert!(data_prop.get("additionalProperties").is_some());
    }
}
