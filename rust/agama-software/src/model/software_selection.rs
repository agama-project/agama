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

use crate::{service, Resolvable};

pub struct ResolvablesSelection {
    id: String,
    optional: bool,
    resolvables: Vec<Resolvable>,
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
    /// Updates a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `optional` - Whether the selection is optional or not.
    /// * `resolvables` - The resolvables included in the set.
    pub async fn set(
        &mut self,
        id: &str,
        optional: bool,
        resolvables: Vec<Resolvable>,
    ) -> Result<(), service::Error> {
        let list = self.find_or_create_selection(id, optional);
        list.resolvables = resolvables;
        Ok(())
    }

    /// Returns a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    pub fn get(&self, id: &str, optional: bool) -> Option<Vec<Resolvable>> {
        self.selections
            .iter()
            .find(|l| l.id == id && l.optional == optional)
            .map(|l| l.resolvables.clone())
    }

    pub fn resolvables<'a>(&'a self) -> impl Iterator<Item = Resolvable> + 'a {
        self.selections
            .iter()
            .map(|s| s.resolvables.clone())
            .flatten()
    }

    fn find_or_create_selection(&mut self, id: &str, optional: bool) -> &mut ResolvablesSelection {
        let found = self
            .selections
            .iter()
            .position(|l| l.id == id && l.optional == optional);

        if let Some(index) = found {
            &mut self.selections[index]
        } else {
            let selection = ResolvablesSelection {
                id: id.to_string(),
                optional,
                resolvables: vec![],
            };
            self.selections.push(selection);
            self.selections.last_mut().unwrap()
        }
    }
}

/* TODO: Fix tests with real mock of libzypp
#[cfg(test)]
mod tests {
    use super::*;

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
    */
