// Copyright (c) [2024] SUSE LLC
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

//! OpenAPI utility struct and functions.

pub mod schemas {
    use std::borrow::Cow;

    use cidr::IpInet;
    use schemars::{JsonSchema, Schema, SchemaGenerator};
    use serde::{Deserialize, Serialize};

    /// Newtype wrapper for IpInet with JsonSchema implementation
    ///
    /// Use this when you want to derive JsonSchema on structs containing IpInet fields.
    ///
    /// Example:
    /// ```
    /// # use agama_utils::openapi::schemas::IpInetSchema;
    /// # use cidr::IpInet;
    ///
    /// #[derive(schemars::JsonSchema)]
    /// struct NetworkConfig {
    ///     #[schemars(with = "IpInetSchema")]
    ///     address: IpInet,
    /// }
    /// ```
    #[derive(Debug, Clone, Serialize, Deserialize)]
    #[serde(transparent)]
    pub struct IpInetSchema(pub IpInet);

    impl JsonSchema for IpInetSchema {
        fn schema_name() -> Cow<'static, str> {
            Cow::Borrowed("IpInet")
        }

        fn json_schema(gen: &mut SchemaGenerator) -> Schema {
            let mut schema = String::json_schema(gen);
            schema.insert(
                "description".into(),
                "An IP address (IPv4 or IPv6) with prefix length in CIDR notation".into(),
            );
            schema.insert(
                "examples".into(),
                serde_json::json!(["192.168.1.254/24", "2001:db8::/32"]),
            );
            schema
        }
    }
}
