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

//! Implements a client to access Agama's D-Bus API related to iSCSI management.

use agama_storage_client::message;
use agama_utils::actor::Handler;
use agama_utils::api::iscsi::Config;
use agama_utils::api::iscsi::DiscoverConfig;
use async_trait::async_trait;
use serde_json::Value;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error("Storage D-Bus server error: {0}")]
    DBusClient(#[from] agama_storage_client::Error),
}

pub enum DiscoverResult {
    Success,
    Failure,
}

#[async_trait]
pub trait ISCSIClient {
    async fn discover(&self, config: DiscoverConfig) -> Result<DiscoverResult, Error>;
    async fn get_system(&self) -> Result<Option<Value>, Error>;
    async fn get_config(&self) -> Result<Option<Config>, Error>;
    async fn set_config(&self, config: Option<Config>) -> Result<(), Error>;
}

#[derive(Clone)]
pub struct Client {
    storage_dbus: Handler<agama_storage_client::Service>,
}

impl Client {
    pub async fn new(
        storage_dbus: Handler<agama_storage_client::Service>,
    ) -> Result<Client, Error> {
        Ok(Self { storage_dbus })
    }
}

#[async_trait]
impl ISCSIClient for Client {
    async fn discover(&self, config: DiscoverConfig) -> Result<DiscoverResult, Error> {
        let result = self
            .storage_dbus
            .call(message::iscsi::Discover::new(config))
            .await?;
        match result {
            0 => Ok(DiscoverResult::Success),
            _ => Ok(DiscoverResult::Failure),
        }
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        Ok(self.storage_dbus.call(message::iscsi::GetSystem).await?)
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        Ok(self.storage_dbus.call(message::iscsi::GetConfig).await?)
    }

    async fn set_config(&self, config: Option<Config>) -> Result<(), Error> {
        self.storage_dbus
            .call(message::iscsi::SetConfig::new(config))
            .await?;
        Ok(())
    }
}
