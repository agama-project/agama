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

/// A schemars [`Transform`] that distributes outer struct properties and required fields into
/// each variant of an `anyOf` array when a struct flattens an untagged enum (e.g. `UserFile`, `Script`).
///
/// # Background & Motivation
///
/// Consider a struct like `UserFile` that flattens an untagged enum:
/// ```rust,ignore
/// #[serde(untagged)]
/// pub enum FileSource {
///     Text { content: String },
///     Remote { url: String },
/// }
///
/// pub struct UserFile {
///     pub destination: String,
///     pub permissions: String,
///     #[serde(flatten)]
///     pub source: FileSource,
/// }
/// ```
///
/// In the autoinstallation profile, users write a single flat JSON object containing both the
/// struct's direct fields and the flattened enum variant's fields:
/// ```json
/// {
///   "destination": "/etc/custom-banner",
///   "permissions": "0644",
///   "content": "Hello World\n"
/// }
/// ```
///
/// However, schemars generates a hybrid schema:
/// - Outer `properties` has `destination` and `permissions`.
/// - An `anyOf` array contains the variants: `{ "properties": { "content": ... } }` and `{ "properties": { "url": ... } }`.
///
/// If `"additionalProperties": false` is placed on the outer object and its variants:
/// 1. The outer object only recognizes `destination` and `permissions`, rejecting `"content"` as an unexpected property.
/// 2. Variant 1 only recognizes `content`, rejecting `"destination"` and `"permissions"` as unexpected properties.
///
/// As a result, valid configurations become impossible to validate.
///
/// # Solution
///
/// This transform distributes the outer struct properties (`destination`, `permissions`) and outer
/// required constraints into each variant of `anyOf`, and removes them from the outer container:
/// ```json
/// {
///   "anyOf": [
///     {
///       "properties": {
///         "content": { "type": "string" },
///         "destination": { "type": "string" },
///         "permissions": { "type": "string" }
///       },
///       "required": ["content", "destination"],
///       "type": "object"
///     },
///     {
///       "properties": {
///         "url": { "type": "string" },
///         "destination": { "type": "string" },
///         "permissions": { "type": "string" }
///       },
///       "required": ["url", "destination"],
///       "type": "object"
///     }
///   ]
/// }
/// ```
/// When `DenyAdditionalProperties` runs next, it sets `"additionalProperties": false` on each variant.
/// Now, valid instances pass, and unexpected keys like `"unknownKey"` are strictly rejected by both variants.
///
/// # Why not `unevaluatedProperties: false`?
///
/// JSON Schema Draft 2019-09 introduced the `unevaluatedProperties` keyword specifically to solve
/// this problem by looking across `anyOf` and `allOf`. However:
/// - Many OpenAPI tools, code generators, and schema validators (especially those targeting OpenAPI 3.0
///   or older JSON Schema drafts) do not support or correctly implement `unevaluatedProperties`.
/// - Distributing properties into `anyOf` variants uses only standard `properties` and `additionalProperties`,
///   ensuring 100% compatibility across all OpenAPI tools, Swagger UI, code generators, and validators.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct DistributeFlattenedEnums;

impl Transform for DistributeFlattenedEnums {
    fn transform(&mut self, schema: &mut Schema) {
        transform_subschemas(self, schema);

        let Some(map) = schema.as_object_mut() else {
            return;
        };

        if !map.contains_key("properties") || !map.contains_key("anyOf") {
            return;
        }

        let Some(Value::Object(outer_props)) = map.remove("properties") else {
            return;
        };

        let outer_req = map.remove("required").and_then(|r| match r {
            Value::Array(a) => Some(a),
            _ => None,
        });

        let Some(Value::Array(variants)) = map.get_mut("anyOf") else {
            return;
        };

        for variant in variants.iter_mut() {
            let Some(v_map) = variant.as_object_mut() else {
                continue;
            };

            let v_props = v_map
                .entry("properties".to_string())
                .or_insert_with(|| Value::Object(serde_json::Map::new()));
            if let Some(v_props_map) = v_props.as_object_mut() {
                for (k, v) in &outer_props {
                    v_props_map.entry(k.clone()).or_insert_with(|| v.clone());
                }
            }

            if let Some(ref outer_req) = outer_req {
                let v_req = v_map
                    .entry("required".to_string())
                    .or_insert_with(|| Value::Array(Vec::new()));
                if let Some(v_req_arr) = v_req.as_array_mut() {
                    for r in outer_req {
                        if !v_req_arr.contains(r) {
                            v_req_arr.push(r.clone());
                        }
                    }
                }
            }

            v_map
                .entry("type".to_string())
                .or_insert_with(|| Value::String("object".to_string()));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::web::schema_transforms::DenyAdditionalProperties;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, JsonSchema)]
    #[serde(untagged)]
    enum TestSource {
        Inline { content: String },
        Remote { url: String },
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct FlattenedFile {
        #[serde(flatten)]
        source: TestSource,
        destination: String,
    }

    #[test]
    fn test_flattened_untagged_enum() {
        let mut schema = schemars::schema_for!(FlattenedFile);
        let mut distribute = DistributeFlattenedEnums;
        let mut deny_additional = DenyAdditionalProperties;
        distribute.transform(&mut schema);
        deny_additional.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        // Outer object should not have properties or additionalProperties: false
        assert!(obj.get("properties").is_none());
        assert!(obj.get("additionalProperties").is_none());

        // anyOf variants should have destination merged and additionalProperties: false
        let variants = obj.get("anyOf").and_then(|a| a.as_array()).unwrap();
        for variant in variants {
            let v_obj = variant.as_object().unwrap();
            assert_eq!(v_obj.get("additionalProperties"), Some(&Value::Bool(false)));
            let v_props = v_obj.get("properties").and_then(|p| p.as_object()).unwrap();
            assert!(v_props.contains_key("destination"));
        }
    }
}
