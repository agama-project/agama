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
//! This module provides [`schemars::transform::Transform`] implementations for post-processing schemas:
//! - [`DenyAdditionalProperties`]: Ensures all object schemas have `"additionalProperties": false`
//!   so that schema validators complain about unknown or unexpected keys.
//! - [`RemoveNullableAnyOf`]: Eliminates schemars default behavior for `Option<T>` that generates
//!   `anyOf: [T, {"type": "null"}]` and `"type": [..., "null"]`.
//! - [`SimplifyEnums`]: Converts `oneOf` or `anyOf` containing scalar constants into clean `enum: [...]` arrays,
//!   preserving variant descriptions in `description` and `x-enum-descriptions`.
//! - [`DistributeFlattenedEnums`]: Merges outer struct properties into flattened untagged enum variants.
//! - [`LinkSubsystemSchemas`]: Links manually defined subsystem schemas (Storage, Dasd, Zfcp, Iscsi)
//!   into the Config, Proposal, and SystemInfo schemas.
//! - [`InjectPropertyAliases`]: Injects deprecated compatibility aliases (`#[serde(alias)]`) and
//!   the editor `$schema` keyword.
//! - [`RewriteStorageRefs`]: Rewrites external file references to `device.storage.schema.json` into
//!   OpenAPI component references `#/components/schemas/StorageDevice...`.

mod deny_additional_properties;
mod distribute_flattened_enums;
mod inject_property_aliases;
mod link_subsystem_schemas;
mod remove_nullable_anyof;
mod rewrite_storage_refs;
mod simplify_enums;
mod utils;

pub(crate) use deny_additional_properties::DenyAdditionalProperties;
pub(crate) use distribute_flattened_enums::DistributeFlattenedEnums;
pub(crate) use inject_property_aliases::InjectPropertyAliases;
pub(crate) use link_subsystem_schemas::LinkSubsystemSchemas;
pub(crate) use remove_nullable_anyof::RemoveNullableAnyOf;
pub(crate) use rewrite_storage_refs::RewriteStorageRefs;
pub(crate) use simplify_enums::SimplifyEnums;
pub(crate) use utils::capitalize;

#[cfg(test)]
mod tests {
    use super::*;
    use schemars::transform::Transform;
    use schemars::JsonSchema;
    use serde::{Deserialize, Serialize};
    use serde_json::Value;

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
        let mut distribute = DistributeFlattenedEnums;
        let mut deny_additional = DenyAdditionalProperties;

        remove_nullable.transform(&mut schema);
        simplify_enums.transform(&mut schema);
        distribute.transform(&mut schema);
        deny_additional.transform(&mut schema);

        let obj = schema.as_object().unwrap();
        assert_eq!(obj.get("additionalProperties"), Some(&Value::Bool(false)));

        let props = obj.get("properties").and_then(|p| p.as_object()).unwrap();
        let product_prop = props.get("product").and_then(|p| p.as_object()).unwrap();
        assert!(!product_prop.contains_key("anyOf"));
        assert!(product_prop.contains_key("$ref"));

        // In $defs, ProductConfig should have additionalProperties: false
        if let Some(defs) = obj.get("$defs").and_then(|d| d.as_object()) {
            if let Some(product_def) = defs.get("ProductConfig").and_then(|p| p.as_object()) {
                assert_eq!(
                    product_def.get("additionalProperties"),
                    Some(&Value::Bool(false))
                );
            }
        }
    }
}
