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

//! Schema transformations for schemars-generated JSON schemas.
//!
//! This module provides [`Transform`] implementations for post-processing schemas:
//! - [`DenyAdditionalProperties`]: Ensures all object schemas have `"additionalProperties": false`
//!   so that schema validators complain about unknown or unexpected keys.
//! - [`RemoveNullableAnyOf`]: Eliminates schemars default behavior for `Option<T>` that generates
//!   `anyOf: [T, {"type": "null"}]` and `"type": [..., "null"]`.
//! - [`SimplifyEnums`]: Converts `oneOf` or `anyOf` containing scalar constants into clean `enum: [...]` arrays.
//! - [`DistributeFlattenedEnums`]: Merges outer struct properties into flattened untagged enum variants.

use schemars::transform::{transform_subschemas, Transform};
use schemars::Schema;
use serde_json::Value;

/// Checks whether a JSON Schema value represents a null type schema (e.g. `{"type": "null"}`).
fn is_null_schema_value(val: &Value) -> bool {
    if let Some(obj) = val.as_object() {
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
    } else {
        false
    }
}

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
/// 2. Variant 0 only recognizes `content`, rejecting `"destination"` and `"permissions"` as unexpected properties.
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
pub struct DistributeFlattenedEnums;

impl Transform for DistributeFlattenedEnums {
    fn transform(&mut self, schema: &mut Schema) {
        transform_subschemas(self, schema);

        if let Some(map) = schema.as_object_mut() {
            if map.contains_key("properties") && map.contains_key("anyOf") {
                let outer_props = map.remove("properties").and_then(|p| match p {
                    Value::Object(o) => Some(o),
                    _ => None,
                });
                let outer_req = map.remove("required").and_then(|r| match r {
                    Value::Array(a) => Some(a),
                    _ => None,
                });

                if let Some(outer_props) = outer_props {
                    if let Some(Value::Array(variants)) = map.get_mut("anyOf") {
                        for variant in variants.iter_mut() {
                            if let Some(v_map) = variant.as_object_mut() {
                                let v_props = v_map
                                    .entry("properties".to_string())
                                    .or_insert_with(|| Value::Object(serde_json::Map::new()));
                                if let Some(v_props_map) = v_props.as_object_mut() {
                                    for (k, v) in &outer_props {
                                        if !v_props_map.contains_key(k) {
                                            v_props_map.insert(k.clone(), v.clone());
                                        }
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
                }
            }
        }
    }
}

/// A schemars [`Transform`] that sets `"additionalProperties": false` on all object schemas
/// that do not already define `additionalProperties`.
///
/// This ensures schema validators reject unexpected keys. Map types (such as `HashMap<String, V>`)
/// that already specify a schema for `additionalProperties` are preserved without change.
#[derive(Debug, Clone, Copy, Default)]
pub struct DenyAdditionalProperties;

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

            if is_object && !map.contains_key("additionalProperties") && !map.contains_key("anyOf") {
                map.insert("additionalProperties".to_string(), Value::Bool(false));
            }
        }

        transform_subschemas(self, schema);
    }
}

/// A schemars [`Transform`] that avoids schemars default behavior for `Option<T>` of
/// generating `anyOf: [T, {"type": "null"}]`.
///
/// When an `anyOf` subschema contains a null schema alongside another schema, this transform
/// strips the null schema. If only a single non-null subschema remains, it unwraps that
/// subschema directly into the parent schema (preserving parent metadata such as `description`
/// or `deprecated`).
///
/// This eliminates misleading validation errors such as:
/// `"{"ID":"Tumbleweed"} is not valid under any of the schemas listed in the 'anyOf' keyword. /product"`
/// allowing the validator to report specific field errors directly on `T`.
#[derive(Debug, Clone, Copy, Default)]
pub struct RemoveNullableAnyOf;

impl Transform for RemoveNullableAnyOf {
    fn transform(&mut self, schema: &mut Schema) {
        // Recurse into nested subschemas first so inner schemas are simplified before outer schemas
        transform_subschemas(self, schema);

        if let Some(map) = schema.as_object_mut() {
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
                            Value::Bool(false) => {
                                if !map.contains_key("not") {
                                    map.insert("not".to_string(), serde_json::json!({}));
                                }
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
}

fn scalar_type(val: &Value) -> Option<&'static str> {
    if val.is_string() {
        Some("string")
    } else if val.is_i64() || val.is_u64() {
        Some("integer")
    } else if val.is_f64() {
        Some("number")
    } else if val.is_boolean() {
        Some("boolean")
    } else {
        None
    }
}

fn extract_scalar_const(val: &Value) -> Option<(Value, &'static str, Option<String>)> {
    if let Some(obj) = val.as_object() {
        let desc = obj
            .get("description")
            .and_then(|d| d.as_str())
            .map(ToString::to_string);
        if let Some(c) = obj.get("const") {
            return scalar_type(c).map(|ty| (c.clone(), ty, desc));
        }
        if let Some(Value::Array(arr)) = obj.get("enum") {
            if arr.len() == 1 {
                return scalar_type(&arr[0]).map(|ty| (arr[0].clone(), ty, desc));
            }
        }
    } else if let Some(ty) = scalar_type(val) {
        return Some((val.clone(), ty, None));
    }
    None
}

/// A schemars [`Transform`] that converts `oneOf` or `anyOf` containing only scalar constants
/// (strings, integers, booleans) into a standard `"type": "<type>"` with an `"enum": [...]` array.
///
/// Schemars generates `oneOf` with `{"const": "variant", "description": "..."}` for enums
/// whose variants have documentation comments. When validation fails on such a schema,
/// validators produce unhelpful errors like:
/// `"value is not valid under any of the schemas listed in the 'oneOf' keyword"`
///
/// Converting them into `"enum": [...]` produces much clearer validation errors listing the
/// permitted values:
/// `"'foo' is not one of ['enabled', 'default']"`
///
/// If any variants have descriptions, they are preserved by:
/// 1. Appending a Markdown list of the variants and their descriptions to the schema's `description`.
/// 2. Adding an `x-enum-descriptions` vendor extension array for OpenAPI code generators.
///
/// # Examples
///
/// ```
/// use agama_server::web::schema_transforms::SimplifyEnums;
/// use schemars::transform::Transform;
/// use schemars::{schema_for, JsonSchema};
/// use serde::{Deserialize, Serialize};
/// use serde_json::Value;
///
/// #[derive(Serialize, Deserialize, JsonSchema)]
/// #[serde(rename_all = "kebab-case")]
/// enum TestProtocol {
///     /// Hypertext Transfer Protocol
///     Http,
///     /// Secure HTTP
///     Https,
///     /// File Transfer Protocol
///     Ftp,
/// }
///
/// let mut schema = schema_for!(TestProtocol);
/// let mut transform = SimplifyEnums;
/// transform.transform(&mut schema);
///
/// let obj = schema.as_object().unwrap();
/// assert!(obj.get("oneOf").is_none());
/// assert!(obj.get("anyOf").is_none());
/// assert_eq!(obj.get("type"), Some(&Value::String("string".to_string())));
///
/// let enum_arr = obj.get("enum").and_then(|e| e.as_array()).unwrap();
/// assert_eq!(enum_arr.len(), 3);
/// assert_eq!(enum_arr[0], "http");
/// assert_eq!(enum_arr[1], "https");
/// assert_eq!(enum_arr[2], "ftp");
///
/// let desc = obj.get("description").and_then(|d| d.as_str()).unwrap();
/// assert!(desc.contains("- `http` - Hypertext Transfer Protocol"));
/// ```
#[derive(Debug, Clone, Copy, Default)]
pub struct SimplifyEnums;

impl Transform for SimplifyEnums {
    fn transform(&mut self, schema: &mut Schema) {
        transform_subschemas(self, schema);

        if let Some(map) = schema.as_object_mut() {
            for key in ["oneOf", "anyOf"] {
                if let Some(Value::Array(arr)) = map.get(key) {
                    if !arr.is_empty() {
                        let extracted: Option<Vec<(Value, &'static str, Option<String>)>> =
                            arr.iter().map(extract_scalar_const).collect();

                        if let Some(items) = extracted {
                            let first_type = items[0].1;
                            let same_type = items.iter().all(|(_, ty, _)| *ty == first_type);
                            let has_any_desc = items.iter().any(|(_, _, d)| d.is_some());

                            let enum_values: Vec<Value> =
                                items.iter().map(|(val, _, _)| val.clone()).collect();

                            map.remove(key);
                            if same_type {
                                map.insert(
                                    "type".to_string(),
                                    Value::String(first_type.to_string()),
                                );
                            }
                            map.insert("enum".to_string(), Value::Array(enum_values));
                            map.remove("additionalProperties");

                            if has_any_desc {
                                let mut list_lines = Vec::new();
                                let mut x_descriptions = Vec::new();

                                for (val, _, desc) in &items {
                                    let val_display = match val {
                                        Value::String(s) => format!("`{}`", s),
                                        other => other.to_string(),
                                    };

                                    if let Some(d) = desc {
                                        list_lines.push(format!("- {} - {}", val_display, d));
                                        x_descriptions.push(Value::String(d.clone()));
                                    } else {
                                        list_lines.push(format!("- {}", val_display));
                                        x_descriptions.push(Value::String(String::new()));
                                    }
                                }

                                let formatted_list = list_lines.join("\n");
                                let new_desc = match map.get("description").and_then(|d| d.as_str()) {
                                    Some(existing) => {
                                        let trimmed = existing.trim_end();
                                        format!("{}\n\nAvailable values:\n{}", trimmed, formatted_list)
                                    }
                                    None => format!("Available values:\n{}", formatted_list),
                                };

                                map.insert("description".to_string(), Value::String(new_desc));
                                map.insert(
                                    "x-enum-descriptions".to_string(),
                                    Value::Array(x_descriptions),
                                );
                            }

                            break;
                        }
                    }
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
    fn test_deny_additional_properties_simple_object() {
        let mut schema = schemars::schema_for!(SimpleUser);
        assert!(schema.as_object().unwrap().get("additionalProperties").is_none());

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
        assert_ne!(data_prop.get("additionalProperties"), Some(&Value::Bool(false)));
        assert!(data_prop.get("additionalProperties").is_some());
    }

    #[test]
    fn test_remove_nullable_anyof_option_field() {
        let mut schema = schemars::schema_for!(Profile);

        // Before transform, the 'product' property has anyOf with null
        let obj_before = schema.as_object().unwrap();
        let props_before = obj_before.get("properties").and_then(|p| p.as_object()).unwrap();
        let product_before = props_before.get("product").and_then(|p| p.as_object()).unwrap();
        assert!(product_before.contains_key("anyOf"));

        let mut transform = RemoveNullableAnyOf;
        transform.transform(&mut schema);

        // After transform, 'anyOf' is eliminated and description is preserved
        let obj_after = schema.as_object().unwrap();
        let props_after = obj_after.get("properties").and_then(|p| p.as_object()).unwrap();
        let product_after = props_after.get("product").and_then(|p| p.as_object()).unwrap();
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
        // ChoiceHolder or UntaggedChoice $defs has anyOf without null, should still have anyOf or oneOf
        if let Some(defs) = obj.get("$defs").and_then(|d| d.as_object()) {
            if let Some(choice_def) = defs.get("UntaggedChoice").and_then(|c| c.as_object()) {
                assert!(choice_def.contains_key("anyOf"));
            }
        }
    }

    #[test]
    fn test_combined_transforms() {
        let mut schema = schemars::schema_for!(Profile);
        let mut remove_nullable = RemoveNullableAnyOf;
        let mut deny_additional = DenyAdditionalProperties;

        remove_nullable.transform(&mut schema);
        deny_additional.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert_eq!(obj.get("additionalProperties"), Some(&Value::Bool(false)));

        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();
        let product_prop = props.get("product").and_then(|p| p.as_object()).unwrap();
        assert!(!product_prop.contains_key("anyOf"));
        assert!(product_prop.contains_key("$ref"));

        // And in $defs, ProductConfig should have additionalProperties: false
        if let Some(defs) = obj.get("$defs").and_then(|d| d.as_object()) {
            if let Some(product_def) = defs.get("ProductConfig").and_then(|p| p.as_object()) {
                assert_eq!(
                    product_def.get("additionalProperties"),
                    Some(&Value::Bool(false))
                );
            }
        }
    }

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

        let s_prop = props.get("optional_string").and_then(|p| p.as_object()).unwrap();
        assert_eq!(s_prop.get("type"), Some(&Value::String("string".to_string())));

        let i_prop = props.get("optional_int").and_then(|p| p.as_object()).unwrap();
        assert_eq!(i_prop.get("type"), Some(&Value::String("integer".to_string())));

        let l_prop = props.get("optional_list").and_then(|p| p.as_object()).unwrap();
        assert_eq!(l_prop.get("type"), Some(&Value::String("array".to_string())));
    }

    #[test]
    fn test_simplify_integer_enums() {
        let mut schema: Schema = serde_json::from_value(serde_json::json!({
            "oneOf": [
                { "const": 1, "description": "One" },
                { "const": 2, "description": "Two" },
                { "const": 3, "description": "Three" }
            ]
        }))
        .unwrap();

        let mut transform = SimplifyEnums;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert!(obj.get("oneOf").is_none());
        assert!(obj.get("anyOf").is_none());
        assert_eq!(obj.get("type"), Some(&Value::String("integer".to_string())));

        let enum_arr = obj.get("enum").and_then(|e| e.as_array()).unwrap();
        assert_eq!(enum_arr.len(), 3);
        assert_eq!(enum_arr[0], 1);
        assert_eq!(enum_arr[1], 2);
        assert_eq!(enum_arr[2], 3);
    }
}
