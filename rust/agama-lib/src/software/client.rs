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

use super::{
    model::{Repository, ResolvableType},
    proxies::{ProposalProxy, Software1Proxy},
};
use crate::error::ServiceError;
use serde::Serialize;
use serde_repr::Serialize_repr;
use std::collections::HashMap;
use zbus::Connection;

// TODO: move it to model?
/// Represents a software product
#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct Pattern {
    /// Pattern name (eg., "aaa_base", "gnome")
    pub name: String,
    /// Pattern category (e.g., "Production")
    pub category: String,
    /// Pattern icon path locally on system
    pub icon: String,
    /// Pattern description
    pub description: String,
    /// Pattern summary
    pub summary: String,
    /// Pattern order
    pub order: String,
}

/// Represents the reason why a pattern is selected.
#[derive(Clone, Copy, Debug, PartialEq, Serialize_repr, utoipa::ToSchema)]
#[repr(u8)]
pub enum SelectedBy {
    /// The pattern was selected by the user.
    User = 0,
    /// The pattern was selected automatically.
    Auto = 1,
    /// The pattern has not be selected.
    None = 2,
}

#[derive(Debug, thiserror::Error)]
#[error("Unknown selected by value: '{0}'")]
pub struct UnknownSelectedBy(u8);

impl TryFrom<u8> for SelectedBy {
    type Error = UnknownSelectedBy;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::User),
            1 => Ok(Self::Auto),
            _ => Err(UnknownSelectedBy(value)),
        }
    }
}

/// D-Bus client for the software service
#[derive(Clone)]
pub struct SoftwareClient<'a> {
    software_proxy: Software1Proxy<'a>,
    proposal_proxy: ProposalProxy<'a>,
}

impl<'a> SoftwareClient<'a> {
    pub async fn new(connection: Connection) -> Result<SoftwareClient<'a>, ServiceError> {
        Ok(Self {
            software_proxy: Software1Proxy::new(&connection).await?,
            proposal_proxy: ProposalProxy::new(&connection).await?,
        })
    }

    /// Returns list of defined repositories
    pub async fn repositories(&self) -> Result<Vec<Repository>, ServiceError> {
        let repositories: Vec<Repository> = self
            .software_proxy
            .list_repositories()
            .await?
            .into_iter()
            .map(
                |(id, alias, name, url, product_dir, enabled, loaded)| Repository {
                    id,
                    alias,
                    name,
                    url,
                    product_dir,
                    enabled,
                    loaded,
                },
            )
            .collect();
        Ok(repositories)
    }

    /// Returns the available patterns
    pub async fn patterns(&self, filtered: bool) -> Result<Vec<Pattern>, ServiceError> {
        let patterns: Vec<Pattern> = self
            .software_proxy
            .list_patterns(filtered)
            .await?
            .into_iter()
            .map(
                |(name, (category, description, icon, summary, order))| Pattern {
                    name,
                    category,
                    icon,
                    description,
                    summary,
                    order,
                },
            )
            .collect();
        Ok(patterns)
    }

    /// Returns the ids of patterns selected by user
    pub async fn user_selected_patterns(&self) -> Result<Vec<String>, ServiceError> {
        let patterns: Vec<String> = self
            .software_proxy
            .selected_patterns()
            .await?
            .into_iter()
            .filter_map(|(id, reason)| match SelectedBy::try_from(reason) {
                Ok(SelectedBy::User) => Some(id),
                Ok(_reason) => None,
                Err(e) => {
                    log::warn!("Ignoring pattern {}. Error: {}", &id, e);
                    None
                }
            })
            .collect();
        Ok(patterns)
    }

    /// Returns the selected pattern and the reason each one selected.
    pub async fn selected_patterns(&self) -> Result<HashMap<String, SelectedBy>, ServiceError> {
        let patterns = self.software_proxy.selected_patterns().await?;
        let patterns = patterns
            .into_iter()
            .filter_map(|(id, reason)| match SelectedBy::try_from(reason) {
                Ok(reason) => Some((id, reason)),
                Err(e) => {
                    log::warn!("Ignoring pattern {}. Error: {}", &id, e);
                    None
                }
            })
            .collect();
        Ok(patterns)
    }

    /// Selects patterns by user
    pub async fn select_patterns(
        &self,
        patterns: HashMap<String, bool>,
    ) -> Result<(), ServiceError> {
        let (add, remove): (Vec<_>, Vec<_>) =
            patterns.into_iter().partition(|(_, install)| *install);

        let add: Vec<_> = add.iter().map(|(name, _)| name.as_ref()).collect();
        let remove: Vec<_> = remove.iter().map(|(name, _)| name.as_ref()).collect();

        let wrong_patterns = self
            .software_proxy
            .set_user_patterns(add.as_slice(), remove.as_slice())
            .await?;
        if !wrong_patterns.is_empty() {
            Err(ServiceError::UnknownPatterns(wrong_patterns))
        } else {
            Ok(())
        }
    }

    /// Returns the required space for installing the selected patterns.
    ///
    /// It returns a formatted string including the size and the unit.
    pub async fn used_disk_space(&self) -> Result<String, ServiceError> {
        Ok(self.software_proxy.used_disk_space().await?)
    }

    /// Starts the process to read the repositories data.
    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.software_proxy.probe().await?)
    }

    /// Updates the resolvables list.
    ///
    /// * `id`: resolvable list ID.
    /// * `r#type`: type of the resolvables.
    /// * `resolvables`: resolvables to add.
    /// * `optional`: whether the resolvables are optional.
    pub async fn set_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        resolvables: &[&str],
        optional: bool,
    ) -> Result<(), ServiceError> {
        self.proposal_proxy
            .set_resolvables(id, r#type as u8, resolvables, optional)
            .await?;
        Ok(())
    }
}
