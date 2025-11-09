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

use std::collections::HashMap;

use crate::Resolvable;

/// A selection of resolvables to be installed.
///
/// It holds a selection of patterns and packages to be installed and whether they are optional or
/// not. This class is similar to the `PackagesProposal` YaST module.
#[derive(Default)]
pub struct SoftwareSelection(HashMap<String, Vec<Resolvable>>);

impl SoftwareSelection {
    /// Updates a set of resolvables.
    ///
    /// * `id` - The id of the set.
    /// * `optional` - Whether the selection is optional or not.
    /// * `resolvables` - The resolvables included in the set.
    pub fn set(&mut self, id: &str, resolvables: Vec<Resolvable>) {
        self.0.insert(id.to_string(), resolvables);
    }

    /// Remove the selection list with the given ID.
    pub fn remove(&mut self, id: &str) {
        self.0.remove(id);
    }

    /// Returns all the resolvables.
    pub fn resolvables<'a>(&'a self) -> impl Iterator<Item = Resolvable> + 'a {
        self.0.values().flatten().cloned()
    }
}

#[cfg(test)]
mod tests {
    use crate::ResolvableType;

    use super::{Resolvable, SoftwareSelection};

    #[test]
    fn test_set_selection() {
        let mut selection = SoftwareSelection::default();
        let resolvable = Resolvable::new("agama-scripts", ResolvableType::Package);
        selection.set("agama", vec![resolvable]);
        let resolvable = Resolvable::new("btrfsprogs", ResolvableType::Pattern);
        selection.set("software", vec![resolvable]);

        let all_resolvables: Vec<_> = selection.resolvables().collect();
        assert_eq!(all_resolvables.len(), 2);
    }

    #[test]
    fn test_remove_selection() {
        let mut selection = SoftwareSelection::default();
        let resolvable = Resolvable::new("agama-scripts", ResolvableType::Package);
        selection.set("agama", vec![resolvable]);

        let all_resolvables: Vec<_> = selection.resolvables().collect();
        assert_eq!(all_resolvables.len(), 1);

        selection.remove("agama");
        let all_resolvables: Vec<_> = selection.resolvables().collect();
        assert!(all_resolvables.is_empty());
    }
}
