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

/// Checks whether a JSON Schema value represents a null type schema (e.g. `{"type": "null"}`).
fn is_null_schema_value(val: &Value) -> bool {
    let Some(obj) = val.as_object() else {
        return false;
    };

    if let Some(ty) = obj.get("type") {
        match ty {
            Value::String(s) => s == "null",
            Value::Array(arr) => arr.len() == 1 && arr[0].as_str() == Some("null"),
            _ => false,
        }
    } else if let Some(c) = obj.get("const") {
        c.is_null()
    } else {
        false
    }
}

/// A schemars [`Transform`] that avoids schemars default behavior for `Option<T>` of
/// generating `anyOf: [T, {"type": "null"}]` and `"type": [..., "null"]`.
///
/// When an `anyOf` subschema contains a null schema alongside another schema, this transform
/// strips the null schema. If only a single non-null subschema remains, it unwraps that
/// subschema directly into the parent schema (preserving parent metadata such as `description`
/// or `deprecated`).
///
/// Similarly, `"type": ["string", "null"]` is simplified to `"type": "string"`.
///
/// This eliminates misleading validation errors like:
/// `"{"ID":"Tumbleweed"} is not valid under any of the schemas listed in the 'anyOf' keyword. /product"`
/// and allows the validator to report specific field errors directly on `T`.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct RemoveNullableAnyOf;

impl Transform for RemoveNullableAnyOf {
    fn transform(&mut self, schema: &mut Schema) {
        // Recurse into nested subschemas first so inner schemas are simplified before outer schemas
        transform_subschemas(self, schema);

        let Some(map) = schema.as_object_mut() else {
            return;
        };

        // Strip "null" from type arrays (e.g. ["string", "null"] -> "string")
        if let Some(Value::Array(arr)) = map.get("type") {
            if arr.iter().any(|v| v.as_str() == Some("null")) {
                let non_null: Vec<Value> = arr
                    .iter()
                    .filter(|v| v.as_str() != Some("null"))
                    .cloned()
                    .collect();

                if non_null.len() == 1 {
                    map.insert("type".to_string(), non_null.into_iter().next().unwrap());
                } else if non_null.len() > 1 {
                    map.insert("type".to_string(), Value::Array(non_null));
                }
            }
        }

        if let Some(Value::Array(arr)) = map.get("anyOf") {
            if arr.iter().any(is_null_schema_value) {
                let non_null: Vec<Value> = arr
                    .iter()
                    .filter(|item| !is_null_schema_value(item))
                    .cloned()
                    .collect();

                map.remove("anyOf");

                if non_null.len() == 1 {
                    let single = non_null.into_iter().next().unwrap();
                    match single {
                        Value::Object(sub_map) => {
                            for (k, v) in sub_map {
                                if !map.contains_key(&k) {
                                    map.insert(k, v);
                                }
                            }
                        }
                        Value::Bool(true) => {}
                        Value::Bool(false) if !map.contains_key("not") => {
                            map.insert("not".to_string(), serde_json::json!({}));
                        }
                        _ => {}
                    }
                } else if non_null.len() > 1 {
                    map.insert("anyOf".to_string(), Value::Array(non_null));
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct ProductConfig {
        id: String,
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct Profile {
        /// Product related configuration
        product: Option<ProductConfig>,
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    #[serde(untagged)]
    enum UntaggedChoice {
        Text(String),
        Number(i64),
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct ChoiceHolder {
        choice: UntaggedChoice,
    }

    #[test]
    fn test_remove_nullable_anyof_option_field() {
        let mut schema = schemars::schema_for!(Profile);

        // Before transform, the 'product' property has anyOf with null
        let obj_before = schema.as_object().unwrap();
        let props_before = obj_before
            .get("properties")
            .and_then(|p| p.as_object())
            .unwrap();
        let product_before = props_before
            .get("product")
            .and_then(|p| p.as_object())
            .unwrap();
        assert!(product_before.contains_key("anyOf"));

        let mut transform = RemoveNullableAnyOf;
        transform.transform(&mut schema);

        // After transform, 'anyOf' is eliminated and description is preserved
        let obj_after = schema.as_object().unwrap();
        let props_after = obj_after
            .get("properties")
            .and_then(|p| p.as_object())
            .unwrap();
        let product_after = props_after
            .get("product")
            .and_then(|p| p.as_object())
            .unwrap();
        assert!(!product_after.contains_key("anyOf"));
        assert!(product_after.contains_key("$ref"));
        assert_eq!(
            product_after.get("description"),
            Some(&Value::String("Product related configuration".to_string()))
        );
    }

    #[test]
    fn test_keep_non_nullable_anyof() {
        let mut schema = schemars::schema_for!(ChoiceHolder);
        let mut transform = RemoveNullableAnyOf;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        if let Some(defs) = obj.get("$defs").and_then(|d| d.as_object()) {
            if let Some(choice_def) = defs.get("UntaggedChoice").and_then(|c| c.as_object()) {
                assert!(choice_def.contains_key("anyOf"));
            }
        }
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct OptionalPrimitives {
        optional_string: Option<String>,
        optional_int: Option<i32>,
        optional_list: Option<Vec<String>>,
    }

    #[test]
    fn test_remove_null_from_type_array() {
        let mut schema = schemars::schema_for!(OptionalPrimitives);
        let mut transform = RemoveNullableAnyOf;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();

        let s_prop = props
            .get("optional_string")
            .and_then(|p| p.as_object())
            .unwrap();
        assert_eq!(
            s_prop.get("type"),
            Some(&Value::String("string".to_string()))
        );

        let i_prop = props
            .get("optional_int")
            .and_then(|p| p.as_object())
            .unwrap();
        assert_eq!(
            i_prop.get("type"),
            Some(&Value::String("integer".to_string()))
        );

        let l_prop = props
            .get("optional_list")
            .and_then(|p| p.as_object())
            .unwrap();
        assert_eq!(
            l_prop.get("type"),
            Some(&Value::String("array".to_string()))
        );
    }
}
