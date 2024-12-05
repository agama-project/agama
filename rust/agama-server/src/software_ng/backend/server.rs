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

use agama_lib::product::Product;
use tokio::sync::{mpsc, oneshot, Mutex};

use crate::{products::ProductsRegistry, web::EventsSender};

use super::{client::SoftwareServiceClient, SoftwareServiceError};

#[derive(Debug)]
pub enum SoftwareAction {
    GetProducts(oneshot::Sender<Vec<Product>>),
}

/// Software service server.
pub struct SoftwareServiceServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    events: EventsSender,
    products: Arc<Mutex<ProductsRegistry>>,
}

impl SoftwareServiceServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate Tokio task and gets the client requests using a channel.
    pub async fn start(
        events: EventsSender,
        products: Arc<Mutex<ProductsRegistry>>,
    ) -> SoftwareServiceClient {
        let (sender, receiver) = mpsc::unbounded_channel();

        let server = Self {
            receiver,
            events,
            products,
        };
        tokio::spawn(async move {
            server.run().await;
        });
        SoftwareServiceClient::new(sender)
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
        }
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
