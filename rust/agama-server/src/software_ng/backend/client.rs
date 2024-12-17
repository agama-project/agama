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

use agama_lib::{
    product::Product,
    progress::ProgressSummary,
    software::{model::ResolvableType, Pattern},
};
use tokio::sync::oneshot;

use crate::common::backend::service_status::ServiceStatusClient;

use super::{server::SoftwareAction, SoftwareActionSender, SoftwareServiceError};

/// Client to interact with the software service.
///
/// It uses a channel to send the actions to the server. It can be cloned and used in different
/// tasks if needed.
#[derive(Clone)]
pub struct SoftwareServiceClient {
    actions: SoftwareActionSender,
    status: ServiceStatusClient,
}

impl SoftwareServiceClient {
    /// Creates a new client.
    pub fn new(actions: SoftwareActionSender, status: ServiceStatusClient) -> Self {
        Self { actions, status }
    }

    /// Returns the list of known products.
    pub async fn get_products(&self) -> Result<Vec<Product>, SoftwareServiceError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(SoftwareAction::GetProducts(tx))?;
        Ok(rx.await?)
    }

    /// Returns the list of known patterns.
    pub async fn get_patterns(&self) -> Result<Vec<Pattern>, SoftwareServiceError> {
        let (tx, rx) = oneshot::channel();
        self.actions.send(SoftwareAction::GetPatterns(tx))?;
        Ok(rx.await?)
    }

    pub async fn select_product(&self, product_id: &str) -> Result<(), SoftwareServiceError> {
        self.actions
            .send(SoftwareAction::SelectProduct(product_id.to_string()))?;
        Ok(())
    }

    pub async fn probe(&self) -> Result<(), SoftwareServiceError> {
        self.actions.send(SoftwareAction::Probe)?;
        Ok(())
    }

    pub fn set_resolvables(
        &self,
        id: &str,
        r#type: ResolvableType,
        resolvables: &[&str],
        optional: bool,
    ) -> Result<(), SoftwareServiceError> {
        let resolvables: Vec<String> = resolvables.iter().map(|r| r.to_string()).collect();
        self.actions.send(SoftwareAction::SetResolvables {
            id: id.to_string(),
            r#type,
            resolvables,
            optional,
        })?;
        Ok(())
    }

    pub async fn get_progress(&self) -> Result<Option<ProgressSummary>, SoftwareServiceError> {
        Ok(self.status.get_progress().await?)
    }
}
