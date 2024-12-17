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

use std::{path::Path, sync::Arc};

use agama_lib::{
    product::Product,
    software::{
        model::{ResolvableType, SoftwareSelection},
        Pattern,
    },
};
use tokio::sync::{mpsc, oneshot, Mutex};

use crate::{
    common::backend::service_status::{ServiceStatusClient, ServiceStatusManager},
    products::{ProductSpec, ProductsRegistry},
    web::EventsSender,
};

use super::{client::SoftwareServiceClient, SoftwareServiceError};

const TARGET_DIR: &str = "/run/agama/software_ng_zypp";
const GPG_KEYS: &str = "/usr/lib/rpm/gnupg/keys/gpg-*";

#[derive(Debug)]
pub enum SoftwareAction {
    Probe,
    GetProducts(oneshot::Sender<Vec<Product>>),
    GetPatterns(oneshot::Sender<Vec<Pattern>>),
    SelectProduct(String),
    SetResolvables {
        id: String,
        r#type: ResolvableType,
        resolvables: Vec<String>,
        optional: bool,
    },
}

/// Software service server.
pub struct SoftwareServiceServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    events: EventsSender,
    products: Arc<Mutex<ProductsRegistry>>,
    status: ServiceStatusClient,
    // FIXME: what about having a SoftwareServiceState to keep business logic state?
    selected_product: Option<String>,
    software_selection: SoftwareSelection,
}

const SERVICE_NAME: &str = "org.opensuse.Agama.Software1";

impl SoftwareServiceServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate Tokio task and gets the client requests using a channel.
    pub async fn start(
        events: EventsSender,
        products: Arc<Mutex<ProductsRegistry>>,
    ) -> Result<SoftwareServiceClient, SoftwareServiceError> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let status = ServiceStatusManager::start(SERVICE_NAME, events.clone());

        let server = Self {
            receiver,
            events,
            products,
            status: status.clone(),
            selected_product: None,
            software_selection: SoftwareSelection::default(),
        };

        tokio::spawn(async move {
            if let Err(error) = server.run().await {
                tracing::error!("Software service could not start: {:?}", error);
            }
        });
        Ok(SoftwareServiceClient::new(sender, status))
    }

    /// Runs the server dispatching the actions received through the input channel.
    async fn run(mut self) -> Result<(), SoftwareServiceError> {
        self.initialize_target_dir()?;

        loop {
            let action = self.receiver.recv().await;
            tracing::debug!("software dispatching action: {:?}", action);
            let Some(action) = action else {
                tracing::error!("Software action channel closed");
                break;
            };

            if let Err(error) = self.dispatch(action).await {
                tracing::error!("Software dispatch error: {:?}", error);
            }
        }

        Ok(())
    }

    /// Forwards the action to the appropriate handler.
    async fn dispatch(&mut self, action: SoftwareAction) -> Result<(), SoftwareServiceError> {
        match action {
            SoftwareAction::GetProducts(tx) => {
                self.get_products(tx).await?;
            }

            SoftwareAction::GetPatterns(tx) => {
                self.get_patterns(tx).await?;
            }

            SoftwareAction::SelectProduct(product_id) => {
                self.select_product(product_id).await?;
            }

            SoftwareAction::Probe => {
                self.probe().await?;
                _ = self.status.finish_task();
            }

            SoftwareAction::SetResolvables {
                id,
                r#type,
                resolvables,
                optional,
            } => {
                let resolvables: Vec<_> = resolvables.iter().map(String::as_str).collect();
                self.software_selection
                    .add(&id, r#type, optional, &resolvables);
            }
        }
        Ok(())
    }

    /// Select the given product.
    async fn select_product(&mut self, product_id: String) -> Result<(), SoftwareServiceError> {
        tracing::info!("Selecting product {}", product_id);
        let products = self.products.lock().await;
        if products.find(&product_id).is_none() {
            return Err(SoftwareServiceError::UnknownProduct(product_id));
        };

        self.selected_product = Some(product_id.clone());
        Ok(())
    }

    async fn probe(&self) -> Result<(), SoftwareServiceError> {
        _ = self
            .status
            .start_task(vec![
                "Add base repositories".to_string(),
                "Refreshing repositories metadata".to_string(),
                // "Calculate software proposal".to_string(),
            ])
            .await;

        let product = self.find_selected_product().await?;
        let repositories = product.software.repositories();
        for (idx, repo) in repositories.iter().enumerate() {
            // TODO: we should add a repository ID in the configuration file.
            let name = format!("agama-{}", idx);
            zypp_agama::add_repository(&name, &repo.url, |percent, alias| {
                tracing::info!("Adding repository {} ({}%)", alias, percent);
                true
            })
            .map_err(SoftwareServiceError::AddRepositoryFailed)?;
        }

        _ = self.status.next_step();

        zypp_agama::load_source(|percent, alias| {
            tracing::info!("Refreshing repositories: {} ({}%)", alias, percent);
            true
        })
        .map_err(SoftwareServiceError::LoadSourcesFailed)?;

        Ok(())
    }

    /// Returns the list of products.
    async fn get_products(
        &self,
        tx: oneshot::Sender<Vec<Product>>,
    ) -> Result<(), SoftwareServiceError> {
        let products = self.products.lock().await;
        // FIXME: implement this conversion at model's level.
        let products: Vec<_> = products
            .products
            .iter()
            .map(|p| Product {
                id: p.id.clone(),
                name: p.name.clone(),
                description: p.description.clone(),
                icon: p.icon.clone(),
                registration: p.registration,
            })
            .collect();
        tx.send(products)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn get_patterns(
        &self,
        tx: oneshot::Sender<Vec<Pattern>>,
    ) -> Result<(), SoftwareServiceError> {
        let product = self.find_selected_product().await?;

        let mandatory_patterns = product.software.mandatory_patterns.iter();
        let optional_patterns = product.software.optional_patterns.unwrap_or(vec![]);
        let optional_patterns = optional_patterns.iter();
        let pattern_names: Vec<&str> = vec![mandatory_patterns, optional_patterns]
            .into_iter()
            .flatten()
            .map(String::as_str)
            .collect();

        let patterns = zypp_agama::patterns_info(pattern_names)
            .map_err(SoftwareServiceError::ListPatternsFailed)?;

        let patterns = patterns
            .into_iter()
            .map(|info| Pattern {
                name: info.name,
                category: info.category,
                description: info.description,
                icon: info.icon,
                summary: info.summary,
                order: info.order,
            })
            .collect();

        tx.send(patterns)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    fn initialize_target_dir(&self) -> Result<(), SoftwareServiceError> {
        let target_dir = Path::new(TARGET_DIR);
        if target_dir.exists() {
            _ = std::fs::remove_dir_all(target_dir);
        }

        std::fs::create_dir_all(target_dir).map_err(SoftwareServiceError::TargetCreationFailed)?;

        zypp_agama::init_target(TARGET_DIR, |text, step, total| {
            tracing::info!("Initializing target: {} ({}/{})", text, step, total);
        })
        .map_err(SoftwareServiceError::TargetInitFailed)?;

        self.import_gpg_keys();
        Ok(())
    }

    fn import_gpg_keys(&self) {
        for file in glob::glob(GPG_KEYS).unwrap() {
            match file {
                Ok(file) => {
                    if let Err(e) = zypp_agama::import_gpg_key(&file.to_string_lossy()) {
                        tracing::error!("Failed to import GPG key: {}", e);
                    }
                }
                Err(e) => {
                    tracing::error!("Could not read GPG key file: {}", e);
                }
            }
        }
    }

    // Returns the spec of the selected product.
    //
    // It causes the spec to be cloned, so we should find a better way to do this.
    async fn find_selected_product(&self) -> Result<ProductSpec, SoftwareServiceError> {
        let products = self.products.lock().await;
        let Some(product_id) = &self.selected_product else {
            return Err(SoftwareServiceError::NoSelectedProduct);
        };

        let Some(product) = products.find(product_id) else {
            return Err(SoftwareServiceError::UnknownProduct(product_id.clone()));
        };

        Ok(product.clone())
    }
}
