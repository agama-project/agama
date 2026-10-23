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
];

/// A schemars [`Transform`] that injects deprecated compatibility aliases into schemas
/// for properties with `#[serde(alias)]` attributes, as well as the editor `$schema` keyword.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct InjectPropertyAliases;

impl Transform for InjectPropertyAliases {
    fn transform(&mut self, schema: &mut Schema) {
        if let Some(map) = schema.as_object_mut() {
            if let Some(Value::Object(props)) = map.get_mut("properties") {
                for &(orig, alias) in ALIAS_PAIRS {
                    if let Some(orig_val) = props.get(orig).cloned() {
                        if !props.contains_key(alias) {
                            let mut alias_val = orig_val;
                            if let Some(a_map) = alias_val.as_object_mut() {
                                a_map.insert("deprecated".to_string(), Value::Bool(true));
                            }
                            props.insert(alias.to_string(), alias_val);
                        }
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
        }

        transform_subschemas(self, schema);
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
        assert!(props.contains_key("localization"));
        assert!(props.contains_key("$schema"));
    }
}
