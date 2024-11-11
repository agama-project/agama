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

pub mod schemas {
    use serde_json::json;
    use utoipa::openapi::{
        schema::{self, SchemaType},
        Object, ObjectBuilder, Type,
    };

    /// Returns the IPAddr schema.
    pub fn ip_addr() -> Object {
        ObjectBuilder::new()
            .schema_type(SchemaType::new(Type::String))
            .description(Some("An IP address (IPv4 or IPv6)".to_string()))
            .examples(vec![json!("192.168.1.100")])
            .build()
    }

    /// Reference to IPAddr schema reference.
    pub fn ip_addr_ref() -> schema::Ref {
        schema::Ref::from_schema_name("IpAddr")
    }

    /// Array of IPAddr schema references.
    pub fn ip_addr_array() -> schema::Array {
        schema::Array::new(ip_addr_ref())
    }

    /// Returns the IpInet schema.
    pub fn ip_inet() -> Object {
        ObjectBuilder::new()
            .schema_type(SchemaType::new(Type::String))
            .description(Some(
                "An IP address (IPv4 or IPv6) including the prefix".to_string(),
            ))
            .examples(vec![json!("192.168.1.254/24")])
            .build()
    }

    /// Reference to IpInet schema reference.
    pub fn ip_inet_ref() -> schema::Ref {
        schema::Ref::from_schema_name("IpInet")
    }

    /// Array of IpInet schema references.
    pub fn ip_inet_array() -> schema::Array {
        schema::Array::new(ip_inet_ref())
    }

    /// MAC address 6 schema.
    pub fn mac_addr6() -> Object {
        ObjectBuilder::new()
            .description(Some("MAC address in EUI-48 format"))
            .build()
    }

    /// MAC address 6 schema reference.
    pub fn mac_addr6_ref() -> schema::Ref {
        schema::Ref::from_schema_name("macaddr.MacAddr6")
    }
}
