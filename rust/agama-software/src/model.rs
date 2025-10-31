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

use agama_utils::api::{software::RepositoryParams, Issue};
use async_trait::async_trait;
use tokio::sync::{mpsc, oneshot};

use crate::{
    model::{
        packages::{Repository, ResolvableType},
        pattern::Pattern,
        products::{ProductSpec, UserPattern},
        registration::{AddonProperties, RegistrationInfo},
        software_selection::SoftwareSelection,
        state::SoftwareState,
    },
    service,
    zypp_server::SoftwareAction,
};

pub mod conflict;
pub mod license;
pub mod packages;
pub mod pattern;
pub mod product;
pub mod products;
pub mod registration;
pub mod software_selection;
pub mod state;

/// Abstract the software-related configuration from the underlying system.
///
/// It offers an API to query and set different software and product elements of a
/// libzypp. This trait can be implemented to replace the real libzypp interaction during
/// tests.
#[async_trait]
pub trait ModelAdapter: Send + Sync + 'static {
    /// List of available patterns.
    async fn patterns(&self) -> Result<Vec<Pattern>, service::Error>;

    /// List of available repositories.
    async fn repositories(&self) -> Result<Vec<Repository>, service::Error>;

    /// Adds given list of repositories and loads them
    async fn add_repositories(&self, list: Vec<RepositoryParams>) -> Result<(), service::Error>;

    /// List of available addons.
    fn addons(&self) -> Result<Vec<AddonProperties>, service::Error>;

    /// info about registration
    fn registration_info(&self) -> Result<RegistrationInfo, service::Error>;

    /// check if package is available
    async fn is_package_available(&self, tag: String) -> Result<bool, service::Error>;

    /// check if package is selected for installation
    async fn is_package_selected(&self, tag: String) -> Result<bool, service::Error>;

    /// Gets resolvables set for given combination of id, type and optional flag
    fn get_resolvables(&self, id: &str, r#type: ResolvableType, optional: bool) -> Vec<String>;

    /// Sets resolvables set for given combination of id, type and optional flag
    async fn set_resolvables(
        &mut self,
        id: &str,
        r#type: ResolvableType,
        resolvables: Vec<String>,
        optional: bool,
    ) -> Result<(), service::Error>;

    /// Probes system and updates info about it.
    async fn probe(&mut self, product: &ProductSpec) -> Result<(), service::Error>;

    /// install rpms to target system
    async fn install(&self) -> Result<bool, service::Error>;

    /// Finalizes system like disabling local repositories
    async fn finish(&self) -> Result<(), service::Error>;

    /// Applies the configuration to the system.
    ///
    /// It does not perform the installation, just update the repositories and
    /// the software selection.
    async fn write(&mut self, software: SoftwareState) -> Result<Vec<Issue>, service::Error>;
}

/// [ModelAdapter] implementation for libzypp systems.
pub struct Model {
    zypp_sender: mpsc::UnboundedSender<SoftwareAction>,
    // FIXME: what about having a SoftwareServiceState to keep business logic state?
    selected_product: Option<ProductSpec>,
    software_selection: SoftwareSelection,
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn new(zypp_sender: mpsc::UnboundedSender<SoftwareAction>) -> Result<Self, service::Error> {
        Ok(Self {
            zypp_sender,
            selected_product: None,
            software_selection: SoftwareSelection::default(),
        })
    }
}

#[async_trait]
impl ModelAdapter for Model {
    async fn write(&mut self, software: SoftwareState) -> Result<Vec<Issue>, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Write {
            state: software,
            tx,
        })?;
        Ok(rx.await??)
    }

    async fn patterns(&self) -> Result<Vec<Pattern>, service::Error> {
        let Some(product) = &self.selected_product else {
            return Err(service::Error::MissingProduct);
        };

        let names = product
            .software
            .user_patterns
            .iter()
            .map(|user_pattern| match user_pattern {
                UserPattern::Plain(name) => name.clone(),
                UserPattern::Preselected(preselected) => preselected.name.clone(),
            })
            .collect();

        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::GetPatternsMetadata(names, tx))?;
        Ok(rx.await??)
    }

    async fn is_package_available(&self, tag: String) -> Result<bool, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::PackageAvailable(tag, tx))?;
        Ok(rx.await??)
    }

    async fn is_package_selected(&self, tag: String) -> Result<bool, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::PackageSelected(tag, tx))?;
        Ok(rx.await??)
    }

    fn get_resolvables(&self, id: &str, r#type: ResolvableType, optional: bool) -> Vec<String> {
        self.software_selection
            .get(id, r#type, optional)
            .unwrap_or_default()
    }

    async fn set_resolvables(
        &mut self,
        id: &str,
        r#type: ResolvableType,
        resolvables: Vec<String>,
        optional: bool,
    ) -> Result<(), service::Error> {
        self.software_selection
            .set(&self.zypp_sender, id, r#type, optional, resolvables)
            .await?;
        Ok(())
    }

    async fn add_repositories(&self, list: Vec<RepositoryParams>) -> Result<(), service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::AddRepositories(list, tx))?;
        Ok(rx.await??)
    }

    async fn probe(&mut self, product: &ProductSpec) -> Result<(), service::Error> {
        let (tx, rx) = oneshot::channel();
        // TODO: create own repository registry that will hold all sources of repositories
        // like manual ones, product ones or ones from kernel cmdline
        let repositories = product
            .software
            .repositories()
            .into_iter()
            .enumerate()
            .map(|(i, r)|
                // we need to get somehow better names and aliases
                RepositoryParams { alias: format!("{}_{}", product.id, i), name: Some(format!("{} {}", product.name, i)), url: r.url.clone(), product_dir: None, enabled: Some(true), priority: None, allow_unsigned: Some(false), gpg_fingerprints: None }
            ).collect();
        self.zypp_sender
            .send(SoftwareAction::AddRepositories(repositories, tx))?;
        rx.await??;

        let installer_id = "Installer";
        self.software_selection
            .set(
                &self.zypp_sender,
                installer_id,
                ResolvableType::Product,
                false,
                vec![product.id.clone()],
            )
            .await?;

        let resolvables: Vec<_> = product.software.mandatory_patterns.clone();
        self.software_selection
            .set(
                &self.zypp_sender,
                installer_id,
                ResolvableType::Pattern,
                false,
                resolvables,
            )
            .await?;

        let resolvables: Vec<_> = product.software.mandatory_packages.clone();
        self.software_selection
            .set(
                &self.zypp_sender,
                installer_id,
                ResolvableType::Package,
                false,
                resolvables,
            )
            .await?;

        let resolvables: Vec<_> = product.software.optional_patterns.clone();
        self.software_selection
            .set(
                &self.zypp_sender,
                installer_id,
                ResolvableType::Pattern,
                true,
                resolvables,
            )
            .await?;

        let resolvables: Vec<_> = product.software.optional_packages.clone();
        self.software_selection
            .set(
                &self.zypp_sender,
                installer_id,
                ResolvableType::Package,
                true,
                resolvables,
            )
            .await?;

        Ok(())
    }

    async fn finish(&self) -> Result<(), service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Finish(tx))?;
        Ok(rx.await??)
    }

    async fn install(&self) -> Result<bool, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Install(tx))?;
        Ok(rx.await??)
    }

    // FIXME: do we want to store here only user specified repos or also ones e.g. get from registration server?
    // now we query libzypp to get all of them
    async fn repositories(&self) -> Result<Vec<Repository>, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::ListRepositories(tx))?;
        Ok(rx.await??)
    }

    fn addons(&self) -> Result<Vec<AddonProperties>, service::Error> {
        todo!()
    }

    fn registration_info(&self) -> Result<RegistrationInfo, service::Error> {
        todo!()
    }
}
