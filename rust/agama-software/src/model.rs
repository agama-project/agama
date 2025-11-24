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

use agama_utils::{
    actor::Handler,
    api::{
        software::{Pattern, Repository, SoftwareProposal, SystemInfo},
        Issue,
    },
    products::{ProductSpec, UserPattern},
    progress, question,
};
use async_trait::async_trait;
use tokio::sync::{mpsc, oneshot};

use crate::{model::state::SoftwareState, service, zypp_server::SoftwareAction};

pub mod conflict;
pub mod packages;
pub mod registration;
pub mod software_selection;
pub mod state;

pub use packages::{Resolvable, ResolvableType};

/// Abstract the software-related configuration from the underlying system.
///
/// It offers an API to query and set different software and product elements of a
/// libzypp. This trait can be implemented to replace the real libzypp interaction during
/// tests.
#[async_trait]
pub trait ModelAdapter: Send + Sync + 'static {
    /// Returns the software system information.
    async fn system_info(&self) -> Result<SystemInfo, service::Error>;

    async fn proposal(&self) -> Result<SoftwareProposal, service::Error>;

    /// Refresh repositories information.
    async fn refresh(&mut self) -> Result<(), service::Error>;

    /// install rpms to target system
    async fn install(&self) -> Result<bool, service::Error>;

    /// Finalizes system like disabling local repositories
    async fn finish(&self) -> Result<(), service::Error>;

    fn set_product(&mut self, product_spec: ProductSpec);

    /// Applies the configuration to the system.
    ///
    /// It does not perform the installation, just update the repositories and
    /// the software selection.
    async fn write(
        &mut self,
        software: SoftwareState,
        progress: Handler<progress::Service>,
    ) -> Result<Vec<Issue>, service::Error>;
}

/// [ModelAdapter] implementation for libzypp systems.
pub struct Model {
    zypp_sender: mpsc::UnboundedSender<SoftwareAction>,
    // FIXME: what about having a SoftwareServiceState to keep business logic state?
    selected_product: Option<ProductSpec>,
    progress: Handler<progress::Service>,
    question: Handler<question::Service>,
    /// Local repositories (from the off-line media and Driver Update Disks).
    repositories: Vec<Repository>,
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn new(
        zypp_sender: mpsc::UnboundedSender<SoftwareAction>,
        repositories: Vec<Repository>,
        progress: Handler<progress::Service>,
        question: Handler<question::Service>,
    ) -> Result<Self, service::Error> {
        Ok(Self {
            zypp_sender,
            selected_product: None,
            progress,
            question,
            repositories,
        })
    }
}

#[async_trait]
impl ModelAdapter for Model {
    // FIXME: the product should be mandatory.
    fn set_product(&mut self, product_spec: ProductSpec) {
        self.selected_product = Some(product_spec);
    }

    async fn write(
        &mut self,
        software: SoftwareState,
        progress: Handler<progress::Service>,
    ) -> Result<Vec<Issue>, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Write {
            state: software,
            progress,
            question: self.question.clone(),
            tx,
        })?;
        Ok(rx.await??)
    }

    /// Returns the software system information.
    async fn system_info(&self) -> Result<SystemInfo, service::Error> {
        let Some(product_spec) = self.selected_product.clone() else {
            return Err(service::Error::MissingProduct);
        };

        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::GetSystemInfo(product_spec, tx))?;
        let mut system_info = rx.await??;

        // set "mandatory" field as the info to decide whether the repository is mandatory or not
        // lives in this struct.
        let local_urls: Vec<_> = self.repositories.iter().map(|r| r.url.as_str()).collect();
        for repo in system_info.repositories.iter_mut() {
            repo.mandatory = local_urls.contains(&repo.url.as_str());
        }

        Ok(system_info)
    }

    async fn refresh(&mut self) -> Result<(), service::Error> {
        unimplemented!()
    }

    async fn finish(&self) -> Result<(), service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Finish(tx))?;
        Ok(rx.await??)
    }

    async fn install(&self) -> Result<bool, service::Error> {
        let (tx, rx) = oneshot::channel();
        self.zypp_sender.send(SoftwareAction::Install(
            tx,
            self.progress.clone(),
            self.question.clone(),
        ))?;
        Ok(rx.await??)
    }

    async fn proposal(&self) -> Result<SoftwareProposal, service::Error> {
        let Some(product_spec) = self.selected_product.clone() else {
            return Err(service::Error::MissingProduct);
        };

        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::GetProposal(product_spec, tx))?;
        Ok(rx.await??)
    }
}
