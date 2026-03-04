// Copyright (c) [2025-2026] SUSE LLC
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

//! Implements a client to access Agama's storage service.

use crate::storage_client::{self, message};
use agama_utils::{
    actor::{self, Handler},
    api::{storage::Config, Issue},
    products::ProductSpec,
    BoxFuture,
};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    DBusName(#[from] zbus::names::Error),
    #[error(transparent)]
    DBusVariant(#[from] zbus::zvariant::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    StorageClient(#[from] storage_client::Error),
}

#[async_trait]
pub trait StorageClient {
    async fn activate(&self) -> Result<(), Error>;
    async fn probe(&self) -> Result<(), Error>;
    async fn install(&self) -> Result<(), Error>;
    async fn finish(&self) -> Result<(), Error>;
    async fn umount(&self) -> Result<(), Error>;
    async fn get_system(&self) -> Result<Option<Value>, Error>;
    async fn get_config(&self) -> Result<Option<Config>, Error>;
    async fn get_config_from_model(&self, model: Value) -> Result<Option<Config>, Error>;
    async fn get_config_model(&self) -> Result<Option<Value>, Error>;
    async fn get_proposal(&self) -> Result<Option<Value>, Error>;
    async fn get_issues(&self) -> Result<Vec<Issue>, Error>;
    async fn set_config(
        &self,
        product: Arc<RwLock<ProductSpec>>,
        config: Option<Config>,
    ) -> Result<BoxFuture<Result<(), Error>>, Error>;
    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error>;
    async fn set_locale(&self, locale: String) -> Result<(), Error>;
}

/// D-Bus client for the storage service
#[derive(Clone)]
pub struct Client {
    storage_client: Handler<storage_client::Service>,
}

impl Client {
    pub fn new(storage_client: Handler<storage_client::Service>) -> Self {
        Self { storage_client }
    }

    async fn call_action(&self, action: &str) -> Result<(), Error> {
        self.storage_client
            .call(message::CallAction::new(action))
            .await?;
        Ok(())
    }
}

#[async_trait]
impl StorageClient for Client {
    async fn activate(&self) -> Result<(), Error> {
        self.call_action("Activate").await
    }

    async fn probe(&self) -> Result<(), Error> {
        self.call_action("Probe").await
    }

    async fn install(&self) -> Result<(), Error> {
        self.call_action("Install").await
    }

    async fn finish(&self) -> Result<(), Error> {
        self.call_action("Finish").await
    }

    async fn umount(&self) -> Result<(), Error> {
        self.call_action("Umount").await
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let value = self.storage_client.call(message::GetSystem).await?;
        Ok(value)
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let value = self.storage_client.call(message::GetStorageConfig).await?;
        Ok(value)
    }

    async fn get_config_from_model(&self, model: Value) -> Result<Option<Config>, Error> {
        let message = message::GetConfigFromModel::new(model);
        let value = self.storage_client.call(message).await?;
        Ok(value)
    }

    async fn get_config_model(&self) -> Result<Option<Value>, Error> {
        let value = self.storage_client.call(message::GetConfigModel).await?;
        Ok(value)
    }

    async fn get_proposal(&self) -> Result<Option<Value>, Error> {
        let value = self.storage_client.call(message::GetProposal).await?;
        Ok(value)
    }

    async fn get_issues(&self) -> Result<Vec<Issue>, Error> {
        let value = self.storage_client.call(message::GetIssues).await?;
        Ok(value)
    }

    async fn set_config(
        &self,
        product: Arc<RwLock<ProductSpec>>,
        config: Option<Config>,
    ) -> Result<BoxFuture<Result<(), Error>>, Error> {
        let message = message::SetStorageConfig::new(product.clone(), config);
        let rx = self.storage_client.call(message).await?;
        Ok(Box::pin(async move { rx.await.map_err(Error::from) }))
    }

    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error> {
        let message = message::SolveConfigModel::new(model);
        let value = self.storage_client.call(message).await?;
        Ok(value)
    }

    async fn set_locale(&self, locale: String) -> Result<(), Error> {
        self.storage_client
            .call(message::SetLocale::new(locale))
            .await?;
        Ok(())
    }
}
