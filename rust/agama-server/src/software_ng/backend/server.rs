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

use std::sync::Arc;

use agama_lib::{product::Product, progress::ProgressSummary};
use tokio::sync::{mpsc, oneshot, Mutex};

use crate::{
    common::backend::service_status::{ServiceStatusClient, ServiceStatusManager},
    products::ProductsRegistry,
    web::EventsSender,
};

use super::{client::SoftwareServiceClient, SoftwareServiceError};

#[derive(Debug)]
pub enum SoftwareAction {
    Probe,
    GetProducts(oneshot::Sender<Vec<Product>>),
    SelectProduct(String),
}

/// Software service server.
pub struct SoftwareServiceServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    events: EventsSender,
    products: Arc<Mutex<ProductsRegistry>>,
    status: ServiceStatusClient,
}

const SERVICE_NAME: &str = "org.opensuse.Agama.Software1";

impl SoftwareServiceServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate Tokio task and gets the client requests using a channel.
    pub async fn start(
        events: EventsSender,
        products: Arc<Mutex<ProductsRegistry>>,
    ) -> SoftwareServiceClient {
        let (sender, receiver) = mpsc::unbounded_channel();

        let status = ServiceStatusManager::start(SERVICE_NAME, events.clone());

        let server = Self {
            receiver,
            events,
            products,
            status: status.clone(),
        };

        tokio::spawn(async move {
            server.run().await;
        });
        SoftwareServiceClient::new(sender, status)
    }

    /// Runs the server dispatching the actions received through the input channel.
    async fn run(mut self) {
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
    }

    /// Forwards the action to the appropriate handler.
    async fn dispatch(&mut self, action: SoftwareAction) -> Result<(), SoftwareServiceError> {
        match action {
            SoftwareAction::GetProducts(tx) => {
                self.get_products(tx).await?;
            }

            SoftwareAction::SelectProduct(product_id) => {
                self.select_product(product_id).await?;
            }

            SoftwareAction::Probe => {
                self.probe().await?;
            }
        }
        Ok(())
    }

    /// Select the given product.
    async fn select_product(&self, product_id: String) -> Result<(), SoftwareServiceError> {
        tracing::info!("Selecting product {}", product_id);
        Ok(())
    }

    async fn probe(&self) -> Result<(), SoftwareServiceError> {
        _ = self
            .status
            .start_task(vec![
                "Refreshing repositories metadata".to_string(),
                "Calculate software proposal".to_string(),
            ])
            .await;

        _ = self.status.next_step();
        _ = self.status.next_step();

        _ = self.status.finish_task();

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
}
