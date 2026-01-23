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

//! Implements a client to access Agama's D-Bus API related to Bootloader management.

use crate::dbus::ISCSIProxy;
use agama_utils::api::iscsi::Config;
use agama_utils::api::iscsi::DiscoverConfig;
use async_trait::async_trait;
use serde_json::Value;
use zbus::Connection;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

#[async_trait]
pub trait ISCSIClient {
    async fn discover(&self, config: DiscoverConfig) -> Result<u32, Error>;
    async fn get_system(&self) -> Result<Option<Value>, Error>;
    async fn get_config(&self) -> Result<Option<Config>, Error>;
    async fn set_config(&self, config: Option<Config>) -> Result<(), Error>;
}

#[derive(Clone)]
pub struct Client<'a> {
    proxy: ISCSIProxy<'a>,
}

impl<'a> Client<'a> {
    pub async fn new(connection: Connection) -> Result<Client<'a>, Error> {
        let proxy = ISCSIProxy::new(&connection).await?;
        Ok(Self { proxy })
    }
}

#[async_trait]
impl<'a> ISCSIClient for Client<'a> {
    async fn discover(&self, config: DiscoverConfig) -> Result<u32, Error> {
        let result = self
            .proxy
            .discover(serde_json::to_string(&config)?.as_str())
            .await?;
        Ok(result)
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let serialized_system = self.proxy.get_system().await?;
        let system: Value = serde_json::from_str(serialized_system.as_str())?;
        match system {
            Value::Null => Ok(None),
            _ => Ok(Some(system)),
        }
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let serialized_config = self.proxy.get_config().await?;
        let value: Value = serde_json::from_str(serialized_config.as_str())?;
        match value {
            Value::Null => Ok(None),
            _ => Ok(Some(Config(value))),
        }
    }

    async fn set_config(&self, config: Option<Config>) -> Result<(), Error> {
        self.proxy
            .set_config(serde_json::to_string(&config)?.as_str())
            .await?;
        Ok(())
    }
}
