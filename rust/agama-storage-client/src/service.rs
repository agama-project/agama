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

use std::future::Future;

use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{bootloader, iscsi, storage::Config, Issue},
    BoxFuture,
};
use async_trait::async_trait;
use tokio::sync::oneshot;

use crate::{
    message,
    proxies::{self, BootloaderProxy, DASDProxy, ISCSIProxy, Storage1Proxy},
};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    DBus(#[from] zbus::Error),
    #[error(transparent)]
    JSON(#[from] serde_json::Error),
    #[error("Method not found: {0}")]
    MethodNotFound(String),
}

/// Builds and starts the service.
pub struct Starter {
    dbus: zbus::Connection,
}

impl Starter {
    pub fn new(dbus: zbus::Connection) -> Self {
        Self { dbus }
    }

    /// Starts the service.
    ///
    /// As part of the initialization process, it reads the information
    /// from each proxy to cache the current values.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let storage_proxy = proxies::Storage1Proxy::new(&self.dbus).await?;
        storage_proxy.config().await?;

        let bootloader_proxy = proxies::BootloaderProxy::new(&self.dbus).await?;
        bootloader_proxy.config().await?;

        let iscsi_proxy = proxies::ISCSIProxy::new(&self.dbus).await?;
        let dasd_proxy = proxies::DASDProxy::new(&self.dbus).await?;

        let service = Service {
            storage_proxy,
            bootloader_proxy,
            iscsi_proxy,
            dasd_proxy,
        };
        let handler = actor::spawn(service);
        Ok(handler)
    }
}

pub struct Service {
    storage_proxy: Storage1Proxy<'static>,
    bootloader_proxy: BootloaderProxy<'static>,
    iscsi_proxy: ISCSIProxy<'static>,
    dasd_proxy: DASDProxy<'static>,
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::CallAction> for Service {
    async fn handle(&mut self, message: message::CallAction) -> Result<(), Error> {
        match message.action.as_str() {
            "Activate" => self.storage_proxy.activate().await?,
            "Probe" => self.storage_proxy.probe().await?,
            "Install" => self.storage_proxy.install().await?,
            "Finish" => self.storage_proxy.finish().await?,
            "Umount" => self.storage_proxy.umount().await?,
            _ => {
                return Err(Error::MethodNotFound(message.action));
            }
        }
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetStorageConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetStorageConfig,
    ) -> Result<Option<Config>, Error> {
        let raw_json = self.storage_proxy.config().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(
        &mut self,
        _message: message::GetSystem,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self.storage_proxy.system().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(
        &mut self,
        _message: message::GetProposal,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self.storage_proxy.proposal().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::GetIssues> for Service {
    async fn handle(&mut self, _message: message::GetIssues) -> Result<Vec<Issue>, Error> {
        let raw_json = self.storage_proxy.issues().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::GetConfigFromModel> for Service {
    async fn handle(
        &mut self,
        message: message::GetConfigFromModel,
    ) -> Result<Option<Config>, Error> {
        let raw_json = self
            .storage_proxy
            .get_config_from_model(&message.model.to_string())
            .await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::GetConfigModel> for Service {
    async fn handle(
        &mut self,
        _message: message::GetConfigModel,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self.storage_proxy.config_model().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::SolveConfigModel> for Service {
    async fn handle(
        &mut self,
        message: message::SolveConfigModel,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self
            .storage_proxy
            .solve_config_model(&message.model.to_string())
            .await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::SetLocale> for Service {
    async fn handle(&mut self, message: message::SetLocale) -> Result<(), Error> {
        Ok(self.storage_proxy.set_locale(&message.locale).await?)
    }
}

#[async_trait]
impl MessageHandler<message::SetStorageConfig> for Service {
    async fn handle(
        &mut self,
        message: message::SetStorageConfig,
    ) -> Result<BoxFuture<Result<(), Error>>, Error> {
        let proxy = self.storage_proxy.clone();
        let result = run_in_background(async move {
            let product = message.product.read().await;
            let product_json = serde_json::to_string(&*product)?;
            let config = message.config.filter(|c| c.has_value());
            let config_json = serde_json::to_string(&config)?;
            proxy.set_config(&product_json, &config_json).await?;
            Ok(())
        });
        Ok(Box::pin(async move {
            result
                .await
                .map_err(|_| Error::Actor(actor::Error::Response(Self::name())))?
        }))
    }
}

#[async_trait]
impl MessageHandler<message::GetBootloaderConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::GetBootloaderConfig,
    ) -> Result<bootloader::Config, Error> {
        let raw_json = self.bootloader_proxy.config().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::SetBootloaderConfig> for Service {
    async fn handle(&mut self, message: message::SetBootloaderConfig) -> Result<(), Error> {
        self.bootloader_proxy
            .set_config(&message.config.to_string())
            .await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::iscsi::Discover> for Service {
    async fn handle(&mut self, message: message::iscsi::Discover) -> Result<u32, Error> {
        let options = serde_json::to_string(&message.config)?;
        Ok(self.iscsi_proxy.discover(&options).await?)
    }
}

#[async_trait]
impl MessageHandler<message::iscsi::GetSystem> for Service {
    async fn handle(
        &mut self,
        _message: message::iscsi::GetSystem,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self.iscsi_proxy.iscsi_system().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::iscsi::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::iscsi::GetConfig,
    ) -> Result<Option<iscsi::Config>, Error> {
        let raw_json = self.iscsi_proxy.config().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::iscsi::SetConfig> for Service {
    async fn handle(&mut self, message: message::iscsi::SetConfig) -> Result<(), Error> {
        let config = serde_json::to_string(&message.config)?;
        Ok(self.iscsi_proxy.set_config(&config).await?)
    }
}

#[async_trait]
impl MessageHandler<message::dasd::Probe> for Service {
    async fn handle(&mut self, _message: message::dasd::Probe) -> Result<(), Error> {
        Ok(self.dasd_proxy.probe().await?)
    }
}

#[async_trait]
impl MessageHandler<message::dasd::GetSystem> for Service {
    async fn handle(
        &mut self,
        _message: message::dasd::GetSystem,
    ) -> Result<Option<serde_json::Value>, Error> {
        let raw_json = self.dasd_proxy.dasd_system().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::dasd::GetConfig> for Service {
    async fn handle(
        &mut self,
        _message: message::dasd::GetConfig,
    ) -> Result<Option<agama_utils::api::RawConfig>, Error> {
        let raw_json = self.dasd_proxy.config().await?;
        Ok(try_from_string(&raw_json)?)
    }
}

#[async_trait]
impl MessageHandler<message::dasd::SetConfig> for Service {
    async fn handle(&mut self, message: message::dasd::SetConfig) -> Result<(), Error> {
        let config = serde_json::to_string(&message.config)?;
        Ok(self.dasd_proxy.set_config(&config).await?)
    }
}

fn run_in_background<F>(func: F) -> oneshot::Receiver<Result<(), Error>>
where
    F: Future<Output = Result<(), Error>> + Send + 'static,
{
    let (tx, rx) = oneshot::channel::<Result<(), Error>>();
    tokio::spawn(async move {
        let result = func.await;
        _ = tx.send(result);
    });
    rx
}

/// Converts a string into a Value.
///
/// If the string is "null", return the default value.
fn try_from_string<T: serde::de::DeserializeOwned + Default>(raw_json: &str) -> Result<T, Error> {
    let json: serde_json::Value = serde_json::from_str(raw_json)?;
    if json.is_null() {
        return Ok(T::default());
    }
    let value = serde_json::from_value(json)?;
    Ok(value)
}
