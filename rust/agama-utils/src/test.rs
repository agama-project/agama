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

//! This crate offers a set of utility struct and functions to be used accross
//! other Agama's crates.

pub mod dbus;

/// Finds all JSON paths that contain a `null` value in `val`.
///
/// Returns a list of path strings (e.g. `["network/connections/0/password"]`).
/// Returns an empty `Vec` if no null values are found.
pub fn find_null_paths(val: &serde_json::Value) -> Vec<String> {
    fn collect(prefix: &str, val: &serde_json::Value, nulls: &mut Vec<String>) {
        match val {
            serde_json::Value::Null => nulls.push(prefix.to_string()),
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    let p = if prefix.is_empty() {
                        k.clone()
                    } else {
                        format!("{}/{}", prefix, k)
                    };
                    collect(&p, v, nulls);
                }
            }
            serde_json::Value::Array(arr) => {
                for (i, v) in arr.iter().enumerate() {
                    collect(&format!("{}/{}", prefix, i), v, nulls);
                }
            }
            _ => {}
        }
    }

    let mut nulls = Vec::new();
    collect("", val, &mut nulls);
    nulls
}

/// Asserts that serializing `val` to JSON produces no `null` values.
///
/// Panics with a list of the paths if any null values are found.
pub fn assert_omits_null<T: serde::Serialize>(val: &T) {
    let json = serde_json::to_value(val).expect("serialize value");
    let nulls = find_null_paths(&json);
    assert!(
        nulls.is_empty(),
        "Type {} serialized null values at paths: {:?}. Ensure `#[serde(skip_serializing_if = \"Option::is_none\")]` is set on optional fields.",
        std::any::type_name::<T>(),
        nulls
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_find_null_paths() {
        let val = json!({
            "a": "hello",
            "b": null,
            "c": {
                "d": 123,
                "e": null
            },
            "f": ["item", null]
        });

        let nulls = find_null_paths(&val);
        assert_eq!(nulls, vec!["b", "c/e", "f/1"]);

        let clean = json!({ "a": 1, "b": [2, 3] });
        assert!(find_null_paths(&clean).is_empty());
    }
}
