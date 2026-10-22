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

/// A schemars [`Transform`] that links manually defined external schemas
/// (Storage, Dasd, Zfcp, Iscsi) into the Config, Proposal, and SystemInfo schemas.
#[derive(Debug, Clone, Copy, Default)]
pub(crate) struct LinkSubsystemSchemas;

impl Transform for LinkSubsystemSchemas {
    fn transform(&mut self, schema: &mut Schema) {
        if let Some(map) = schema.as_object_mut() {
            let title = map.get("title").and_then(|t| t.as_str());
            let is_profile = title == Some("Profile");
            let is_proposal = title == Some("Proposal");
            let is_system_info = title == Some("SystemInfo");

            if let Some(Value::Object(props)) = map.get_mut("properties") {
                // Config schema links
                if is_profile
                    || (props.contains_key("product")
                        && props.contains_key("software")
                        && props.contains_key("storage"))
                {
                    for (prop, schema_name) in [
                        ("storage", "StorageConfig"),
                        ("dasd", "DasdConfig"),
                        ("zfcp", "ZfcpConfig"),
                        ("iscsi", "IscsiConfig"),
                    ] {
                        if let Some(p) = props.get_mut(prop) {
                            *p = serde_json::json!({
                                "$ref": format!("#/components/schemas/{}", schema_name)
                            });
                        }
                    }
                } else if is_proposal
                    || (!props.contains_key("product")
                        && props.contains_key("storage")
                        && props.contains_key("software"))
                {
                    if let Some(p) = props.get_mut("storage") {
                        *p = serde_json::json!({
                            "$ref": "#/components/schemas/StorageProposal"
                        });
                    }
                } else if is_system_info
                    || (!props.contains_key("product")
                        && props.contains_key("bootloader")
                        && props.contains_key("storage")
                        && props.contains_key("dasd"))
                {
                    for (prop, schema_name) in [
                        ("bootloader", "BootloaderSystemInfo"),
                        ("dasd", "DasdSystemInfo"),
                        ("iscsi", "IscsiSystemInfo"),
                        ("storage", "StorageSystemInfo"),
                        ("zfcp", "ZfcpSystemInfo"),
                    ] {
                        if let Some(p) = props.get_mut(prop) {
                            *p = serde_json::json!({
                                "$ref": format!("#/components/schemas/{}", schema_name)
                            });
                        }
                    }
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
    fn test_link_subsystem_schemas() {
        let mut schema: Schema = serde_json::from_value(serde_json::json!({
            "title": "Profile",
            "type": "object",
            "properties": {
                "storage": {},
                "dasd": {},
                "zfcp": {},
                "iscsi": {}
            }
        }))
        .unwrap();

        let mut transform = LinkSubsystemSchemas;
        transform.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();

        assert_eq!(
            props.get("storage").unwrap().get("$ref"),
            Some(&Value::String(
                "#/components/schemas/StorageConfig".to_string()
            ))
        );
        assert_eq!(
            props.get("dasd").unwrap().get("$ref"),
            Some(&Value::String(
                "#/components/schemas/DasdConfig".to_string()
            ))
        );
        assert_eq!(
            props.get("zfcp").unwrap().get("$ref"),
            Some(&Value::String(
                "#/components/schemas/ZfcpConfig".to_string()
            ))
        );
        assert_eq!(
            props.get("iscsi").unwrap().get("$ref"),
            Some(&Value::String(
                "#/components/schemas/IscsiConfig".to_string()
            ))
        );
    }
}
