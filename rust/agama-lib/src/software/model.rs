// Copyright (c) [2025] SUSE LLC
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

mod conflict;
mod license;
mod packages;
mod registration;

pub use conflict::*;
pub use license::*;
pub use packages::*;
pub use registration::*;

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
