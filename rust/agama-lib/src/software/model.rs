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

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SoftwareConfig {
    /// A map where the keys are the pattern names and the values whether to install them or not.
    pub patterns: Option<HashMap<String, bool>>,
    /// Name of the product to install.
    pub product: Option<String>,
}

/// Software service configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RegistrationParams {
    /// Registration key.
    pub key: String,
    /// Registration email.
    pub email: String,
}

/// Information about registration configuration (product, patterns, etc.).
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationInfo {
    /// Registration key. Empty value mean key not used or not registered.
    pub key: String,
    /// Registration email. Empty value mean email not used or not registered.
    pub email: String,
}

#[derive(
    Clone,
    Copy,
    Debug,
    Default,
    Deserialize,
    PartialEq,
    Serialize,
    strum::Display,
    strum::EnumString,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum RegistrationRequirement {
    /// Product does not require registration
    #[default]
    No = 0,
    /// Product has optional registration
    Optional = 1,
    /// It is mandatory to register the product
    Mandatory = 2,
}

/// Software resolvable type (package or pattern).
#[derive(
    Copy, Clone, Debug, Deserialize, PartialEq, Serialize, strum::Display, utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum ResolvableType {
    Package = 0,
    Pattern = 1,
}

/// Resolvable list specification.
#[derive(Deserialize, Serialize, utoipa::ToSchema)]
pub struct ResolvableParams {
    /// List of resolvables.
    pub names: Vec<String>,
    /// Resolvable type.
    pub r#type: ResolvableType,
    /// Whether the resolvables are optional or not.
    pub optional: bool,
}

pub struct ResolvablesSelection {
    id: String,
    optional: bool,
    resolvables: Vec<String>,
    r#type: ResolvableType,
}

/// A selection of resolvables to be installed.
///
/// It holds a selection of patterns and packages to be installed and whether they are optional or
/// not. This class is similar to the `PackagesProposal` YaST module.
#[derive(Default)]
pub struct SoftwareSelection {
    selections: Vec<ResolvablesSelection>,
}

impl SoftwareSelection {
    pub fn new() -> Self {
        Default::default()
    }

    /// Adds a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    /// * `resolvables` - The resolvables to add.
    pub fn add(&mut self, id: &str, r#type: ResolvableType, optional: bool, resolvables: &[&str]) {
        let list = self.find_or_create_selection(id, r#type, optional);
        let new_resolvables: Vec<_> = resolvables.iter().map(|r| r.to_string()).collect();
        list.resolvables.extend(new_resolvables);
    }

    /// Updates a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    /// * `resolvables` - The resolvables included in the set.
    pub fn set(&mut self, id: &str, r#type: ResolvableType, optional: bool, resolvables: &[&str]) {
        let list = self.find_or_create_selection(id, r#type, optional);
        let new_resolvables: Vec<_> = resolvables.iter().map(|r| r.to_string()).collect();
        list.resolvables = new_resolvables;
    }

    /// Returns a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    pub fn get(&self, id: &str, r#type: ResolvableType, optional: bool) -> Option<Vec<String>> {
        self.selections
            .iter()
            .find(|l| l.id == id && l.r#type == r#type && l.optional == optional)
            .map(|l| l.resolvables.clone())
    }

    /// Removes the given resolvables from a set.
    ///
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    pub fn remove(&mut self, id: &str, r#type: ResolvableType, optional: bool) {
        self.selections
            .retain(|l| l.id != id || l.r#type != r#type || l.optional != optional);
    }

    fn find_or_create_selection(
        &mut self,
        id: &str,
        r#type: ResolvableType,
        optional: bool,
    ) -> &mut ResolvablesSelection {
        let found = self
            .selections
            .iter()
            .position(|l| l.id == id && l.r#type == r#type && l.optional == optional);

        if let Some(index) = found {
            &mut self.selections[index]
        } else {
            let selection = ResolvablesSelection {
                id: id.to_string(),
                r#type,
                optional,
                resolvables: vec![],
            };
            self.selections.push(selection);
            self.selections.last_mut().unwrap()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_selection() {
        let mut selection = SoftwareSelection::new();
        selection.set("agama", ResolvableType::Package, false, &["agama-scripts"]);
        selection.add("agama", ResolvableType::Package, false, &["suse"]);

        let packages = selection
            .get("agama", ResolvableType::Package, false)
            .unwrap();
        assert_eq!(packages.len(), 2);
    }

    #[test]
    fn test_set_selection() {
        let mut selection = SoftwareSelection::new();
        selection.add("agama", ResolvableType::Package, false, &["agama-scripts"]);
        selection.set("agama", ResolvableType::Package, false, &["suse"]);

        let packages = selection
            .get("agama", ResolvableType::Package, false)
            .unwrap();
        assert_eq!(packages.len(), 1);
    }

    #[test]
    fn test_remove_selection() {
        let mut selection = SoftwareSelection::new();
        selection.add("agama", ResolvableType::Package, true, &["agama-scripts"]);
        selection.remove("agama", ResolvableType::Package, true);
        let packages = selection.get("agama", ResolvableType::Package, true);
        assert_eq!(packages, None);
    }
}
