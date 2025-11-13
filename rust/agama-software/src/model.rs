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
        software::{Pattern, SoftwareProposal},
        Issue,
    },
    products_registry::{ProductSpec, UserPattern},
    progress,
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
    /// List of available patterns.
    async fn patterns(&self) -> Result<Vec<Pattern>, service::Error>;

    async fn compute_proposal(&self) -> Result<SoftwareProposal, service::Error>;

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
}

impl Model {
    /// Initializes the struct with the information from the underlying system.
    pub fn new(zypp_sender: mpsc::UnboundedSender<SoftwareAction>) -> Result<Self, service::Error> {
        Ok(Self {
            zypp_sender,
            selected_product: None,
        })
    }
}

#[async_trait]
impl ModelAdapter for Model {
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
        self.zypp_sender.send(SoftwareAction::Install(tx))?;
        Ok(rx.await??)
    }

    async fn compute_proposal(&self) -> Result<SoftwareProposal, service::Error> {
        let Some(product_spec) = self.selected_product.clone() else {
            return Err(service::Error::MissingProduct);
        };

        let (tx, rx) = oneshot::channel();
        self.zypp_sender
            .send(SoftwareAction::ComputeProposal(product_spec, tx))?;
        Ok(rx.await??)
    }
}
