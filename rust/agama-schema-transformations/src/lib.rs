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
//! This crate provides [`schemars::transform::Transform`] implementations for post-processing
//! schemas:
//! - [`RemoveNullableAnyOf`]: Eliminates schemars default behavior for `Option<T>` that generates
//!   `anyOf: [T, {"type": "null"}]` and `"type": [..., "null"]`.
//! - [`SimplifyEnums`]: Converts `oneOf` or `anyOf` containing scalar constants into clean
//!   `enum: [...]` arrays, preserving descriptions in `description` and `x-enum-descriptions`.
//! - [`LinkSubsystemSchemas`]: Links manually defined subsystem schemas (Storage, Dasd, Zfcp, Iscsi)
//!   into the Config, Proposal, and SystemInfo schemas.
//! - [`InjectPropertyAliases`]: Injects deprecated compatibility aliases (`#[serde(alias)]`) and
//!   the editor `$schema` keyword.
//! - [`RewriteStorageRefs`]: Rewrites external file references to `device.storage.schema.json` into
//!   OpenAPI component references `#/components/schemas/StorageDevice...`.

mod inject_property_aliases;
mod link_subsystem_schemas;
mod remove_nullable_anyof;
mod rewrite_storage_refs;
mod simplify_enums;
mod utils;

pub use inject_property_aliases::InjectPropertyAliases;
pub use link_subsystem_schemas::LinkSubsystemSchemas;
pub use remove_nullable_anyof::RemoveNullableAnyOf;
pub use rewrite_storage_refs::RewriteStorageRefs;
pub use simplify_enums::SimplifyEnums;
pub use utils::capitalize;

#[cfg(test)]
mod tests {
    use super::*;
    use schemars::transform::Transform;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct ProductConfig {
        id: String,
    }

    #[derive(Serialize, Deserialize, JsonSchema)]
    struct Profile {
        /// Product related configuration
        product: Option<ProductConfig>,
    }

    #[test]
    fn test_combined_transforms() {
        let mut schema = schemars::schema_for!(Profile);
        let mut remove_nullable = RemoveNullableAnyOf;
        let mut simplify_enums = SimplifyEnums;

        remove_nullable.transform(&mut schema);
        simplify_enums.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();
        let product_prop = props.get("product").and_then(|p| p.as_object()).unwrap();
        assert!(!product_prop.contains_key("anyOf"));
        assert!(product_prop.contains_key("$ref"));
    }
}
