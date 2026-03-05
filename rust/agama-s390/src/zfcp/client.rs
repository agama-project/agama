// Copyright (c) [2026] SUSE LLC
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

//! Implements a client to access Agama's D-Bus API related to zFCP management.

use crate::storage_client::{self, message};
use agama_utils::actor::Handler;
use agama_utils::api::RawConfig;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    StorageClient(#[from] storage_client::Error),
}

#[async_trait]
pub trait ZFCPClient {
    async fn probe(&self) -> Result<(), Error>;
    async fn get_system(&self) -> Result<Option<Value>, Error>;
    async fn get_config(&self) -> Result<Option<RawConfig>, Error>;
    async fn set_config(&self, config: Option<RawConfig>) -> Result<(), Error>;
}

#[derive(Clone)]
pub struct Client {
    storage_client: Handler<storage_client::Service>,
}

impl Client {
    pub fn new(storage_client: Handler<storage_client::Service>) -> Self {
        Self { storage_client }
    }
}

#[async_trait]
impl ZFCPClient for Client {
    async fn probe(&self) -> Result<(), Error> {
        Ok(self.storage_client.call(message::zfcp::Probe).await?)
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        Ok(self.storage_client.call(message::zfcp::GetSystem).await?)
    }

    async fn get_config(&self) -> Result<Option<RawConfig>, Error> {
        Ok(self.storage_client.call(message::zfcp::GetConfig).await?)
    }

    async fn set_config(&self, config: Option<RawConfig>) -> Result<(), Error> {
        self.storage_client
            .call(message::zfcp::SetConfig::new(config))
            .await?;
        Ok(())
    }
}
