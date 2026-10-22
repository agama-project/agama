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

//! JSON schema of the network section of the profile.
//!
//! It is generated from the types the section is read into, so both always agree. Run
//! `cargo xtask network-schema` to write it to `share/network.schema.json`, which the profile
//! schema refers to.

use super::Config;
use schemars::generate::{Contract, SchemaSettings};

/// ID of the network schema, next to the profile schema that refers to it.
pub const PROFILE_SCHEMA_ID: &str =
    "https://github.com/agama-project/agama/blob/master/rust/share/network.schema.json";

/// Returns the JSON schema of the network section of the profile.
pub fn profile_schema() -> serde_json::Value {
    let mut settings = SchemaSettings::draft2019_09();
    // The profile is read, not written.
    settings.contract = Contract::Deserialize;
    let schema = settings.into_generator().into_root_schema_for::<Config>();

    let mut value = serde_json::to_value(schema).expect("the network schema is valid JSON");
    if let Some(root) = value.as_object_mut() {
        root.insert("$id".to_string(), PROFILE_SCHEMA_ID.into());
        root.insert("title".to_string(), "Network settings".into());
    }
    value
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_the_network_schema_file_is_up_to_date() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../share/network.schema.json");
        let current: serde_json::Value =
            serde_json::from_str(&std::fs::read_to_string(path).unwrap()).unwrap();

        assert!(
            current == profile_schema(),
            "share/network.schema.json is outdated, run `cargo xtask network-schema`"
        );
    }
}
