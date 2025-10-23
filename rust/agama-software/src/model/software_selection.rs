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

use tokio::sync::{mpsc, oneshot};

use crate::{model::packages::ResolvableType, service, zypp_server::SoftwareAction};

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
    /// Updates a set of resolvables.
    ///
    /// * `zypp` - pointer to message bus to zypp thread  to do real action
    /// * `id` - The id of the set.
    /// * `r#type` - The type of the resolvables (patterns or packages).
    /// * `optional` - Whether the selection is optional or not.
    /// * `resolvables` - The resolvables included in the set.
    pub async fn set(
        &mut self,
        zypp: &mpsc::UnboundedSender<SoftwareAction>,
        id: &str,
        r#type: ResolvableType,
        optional: bool,
        resolvables: Vec<String>,
    ) -> Result<(), service::Error> {
        let list = self.find_or_create_selection(id, r#type, optional);
        // FIXME: use reference counting here, if multiple ids require some package, to not unselect it
        let (tx, rx) = oneshot::channel();
        zypp.send(SoftwareAction::UnsetResolvables {
            tx,
            resolvables: list.resolvables.clone(),
            r#type: r#type.into(),
            optional,
        })?;
        rx.await??;

        list.resolvables = resolvables;
        let (tx, rx) = oneshot::channel();
        zypp.send(SoftwareAction::UnsetResolvables {
            tx,
            resolvables: list.resolvables.clone(),
            r#type: r#type.into(),
            optional,
        })?;
        rx.await??;
        Ok(())
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
