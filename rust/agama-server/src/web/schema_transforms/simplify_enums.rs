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
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct SimplifyEnums;

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

    #[derive(Serialize, Deserialize, JsonSchema)]
    #[serde(rename_all = "kebab-case")]
    enum TestProtocol {
        /// Hypertext Transfer Protocol
        Http,
        /// Secure HTTP
        Https,
        /// File Transfer Protocol
        Ftp,
    }

    #[test]
    fn test_simplify_string_enums() {
        let mut schema = schemars::schema_for!(TestProtocol);
        let mut transform = SimplifyEnums;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert!(obj.get("oneOf").is_none());
        assert!(obj.get("anyOf").is_none());
        assert_eq!(obj.get("type"), Some(&Value::String("string".to_string())));

        let enum_arr = obj.get("enum").and_then(|e| e.as_array()).unwrap();
        assert_eq!(enum_arr.len(), 3);
        assert_eq!(enum_arr[0], "http");
        assert_eq!(enum_arr[1], "https");
        assert_eq!(enum_arr[2], "ftp");

        // Verify that descriptions are preserved in the markdown description
        let desc = obj.get("description").and_then(|d| d.as_str()).unwrap();
        assert!(desc.contains("- `http` - Hypertext Transfer Protocol"));
        assert!(desc.contains("- `https` - Secure HTTP"));
        assert!(desc.contains("- `ftp` - File Transfer Protocol"));

        // Verify that x-enum-descriptions extension is present
        let x_desc = obj.get("x-enum-descriptions").and_then(|x| x.as_array()).unwrap();
        assert_eq!(x_desc.len(), 3);
        assert_eq!(x_desc[0], "Hypertext Transfer Protocol");
        assert_eq!(x_desc[1], "Secure HTTP");
        assert_eq!(x_desc[2], "File Transfer Protocol");
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
