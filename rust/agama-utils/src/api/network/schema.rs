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
//! It is generated from the types the section is read into, so both always agree. The published
//! profile schema is generated from the same types (see `cargo xtask openapi`); this one stands on
//! its own, so the network crate can check its input and output without the whole API.

use super::Config;
use schemars::generate::{Contract, SchemaSettings};

/// Returns the JSON schema of the network section of the profile.
pub fn profile_schema() -> serde_json::Value {
    let mut settings = SchemaSettings::draft2019_09();
    // The profile is read, not written.
    settings.contract = Contract::Deserialize;
    let schema = settings.into_generator().into_root_schema_for::<Config>();

    let mut value = serde_json::to_value(schema).expect("the network schema is valid JSON");
    if let Some(root) = value.as_object_mut() {
        root.insert("title".to_string(), "Network settings".into());
    }
    value
}
