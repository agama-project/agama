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

const ALIAS_PAIRS: &[(&str, &str)] = &[
    ("hostname", "transient"),
    ("locale", "language"),
    ("keymap", "keyboard"),
    ("sshPublicKeys", "sshPublicKey"),
    ("dnsSearchList", "dnsSearchlist"),
    ("action", "answer"),
    ("value", "password"),
    ("ieee8021x", "ieee-8021x"),
];

/// A schemars [`Transform`] that injects deprecated compatibility aliases into schemas
/// for properties with `#[serde(alias)]` attributes, as well as the editor `$schema` keyword.
#[derive(Debug, Clone, Copy, Default)]
pub struct InjectPropertyAliases;

impl Transform for InjectPropertyAliases {
    fn transform(&mut self, schema: &mut Schema) {
        transform_subschemas(self, schema);

        let Some(map) = schema.as_object_mut() else {
            return;
        };

        let mut aliased = Vec::new();

        if let Some(Value::Object(props)) = map.get_mut("properties") {
            for &(orig, alias) in ALIAS_PAIRS {
                let Some(orig_val) = props.get(orig).cloned() else {
                    continue;
                };

                if !props.contains_key(alias) {
                    let mut alias_val = orig_val;
                    if let Some(a_map) = alias_val.as_object_mut() {
                        a_map.insert("deprecated".to_string(), Value::Bool(true));
                    }
                    props.insert(alias.to_string(), alias_val);
                    aliased.push((orig, alias));
                }
            }

            // Inject localization alias if l10n is present
            if props.contains_key("l10n") && !props.contains_key("localization") {
                props.insert(
                    "localization".to_string(),
                    serde_json::json!({
                        "deprecated": true,
                        "title": "Localization settings (old schema)",
                        "description": "Deprecated: use l10n instead.",
                        "$ref": "#/components/schemas/l10n.Config"
                    }),
                );
            }

            // Inject $schema keyword on root Config
            if props.contains_key("product")
                && props.contains_key("software")
                && !props.contains_key("$schema")
            {
                props.insert(
                    "$schema".to_string(),
                    serde_json::json!({
                        "title": "URL of the JSON validation schema",
                        "description": "The schema location is ignored by the installer, it always uses the built-in schema, but it can be useful for automatic validation and code completion in some editors.",
                        "type": "string"
                    }),
                );
            }
        }

        // When an aliased property was required, drop it from required and enforce that
        // exactly one of the original or alias keys is present using oneOf.
        if !aliased.is_empty() {
            let mut one_of_pairs = Vec::new();

            if let Some(Value::Array(reqs)) = map.get_mut("required") {
                for (orig, alias) in aliased {
                    if reqs.iter().any(|r| r.as_str() == Some(orig)) {
                        reqs.retain(|r| r.as_str() != Some(orig));
                        one_of_pairs.push((orig, alias));
                    }
                }

                if reqs.is_empty() {
                    map.remove("required");
                }
            }

            for (orig, alias) in one_of_pairs {
                let pair_one_of = serde_json::json!({
                    "oneOf": [
                        { "required": [orig] },
                        { "required": [alias] }
                    ]
                });

                if !map.contains_key("oneOf") && !map.contains_key("allOf") {
                    map.insert(
                        "oneOf".to_string(),
                        Value::Array(vec![
                            serde_json::json!({ "required": [orig] }),
                            serde_json::json!({ "required": [alias] }),
                        ]),
                    );
                } else {
                    let all_of = map
                        .entry("allOf".to_string())
                        .or_insert_with(|| Value::Array(Vec::new()));
                    if let Some(arr) = all_of.as_array_mut() {
                        arr.push(pair_one_of);
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inject_property_aliases() {
        let mut schema: Schema = serde_json::from_value(serde_json::json!({
            "type": "object",
            "properties": {
                "hostname": { "type": "string" },
                "locale": { "type": "string" },
                "keymap": { "type": "string" },
                "sshPublicKeys": { "type": "array" },
                "dnsSearchList": { "type": "array" },
                "action": { "type": "string" },
                "value": { "type": "string" },
                "ieee8021x": { "type": "object" },
                "l10n": { "$ref": "#/components/schemas/l10n.Config" },
                "product": {},
                "software": {}
            }
        }))
        .unwrap();

        let mut transform = InjectPropertyAliases;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();

        assert!(props.contains_key("transient"));
        assert_eq!(
            props.get("transient").unwrap().get("deprecated"),
            Some(&Value::Bool(true))
        );

        assert!(props.contains_key("language"));
        assert_eq!(
            props.get("language").unwrap().get("deprecated"),
            Some(&Value::Bool(true))
        );

        assert!(props.contains_key("keyboard"));
        assert!(props.contains_key("sshPublicKey"));
        assert!(props.contains_key("dnsSearchlist"));
        assert!(props.contains_key("answer"));
        assert_eq!(
            props.get("answer").unwrap().get("deprecated"),
            Some(&Value::Bool(true))
        );
        assert!(props.contains_key("password"));
        assert_eq!(
            props.get("password").unwrap().get("deprecated"),
            Some(&Value::Bool(true))
        );
        assert!(props.contains_key("ieee-8021x"));
        assert_eq!(
            props.get("ieee-8021x").unwrap().get("deprecated"),
            Some(&Value::Bool(true))
        );
        assert!(props.contains_key("localization"));
        assert!(props.contains_key("$schema"));
    }

    #[test]
    fn test_inject_property_aliases_handles_required() {
        let mut schema: Schema = serde_json::from_value(serde_json::json!({
            "type": "object",
            "properties": {
                "action": { "type": "string" },
                "value": { "type": "string" }
            },
            "required": ["action"]
        }))
        .unwrap();

        let mut transform = InjectPropertyAliases;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let required = obj.get("required").and_then(|r| r.as_array());
        assert!(
            required.map_or(true, |r| !r.contains(&serde_json::json!("action"))),
            "Expected 'action' to be removed from required when aliased"
        );
        let one_of = obj.get("oneOf").and_then(|o| o.as_array());
        assert!(
            one_of.is_some(),
            "Expected 'oneOf' to require either 'action' or 'answer'"
        );
        let branches = one_of.unwrap();
        assert_eq!(branches.len(), 2);
        assert_eq!(branches[0], serde_json::json!({ "required": ["action"] }));
        assert_eq!(branches[1], serde_json::json!({ "required": ["answer"] }));
    }
}
