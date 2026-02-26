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

use agama_utils::{
    api::{storage::Config, Issue},
    products::ProductSpec,
};
use async_trait::async_trait;
use serde_json::Value;
use std::{future::Future, sync::Arc};
use tokio::sync::{oneshot, RwLock};
use zbus::{names::BusName, zvariant::OwnedObjectPath, Connection, Message};

use crate::proxies::Storage1Proxy;

const SERVICE_NAME: &str = "org.opensuse.Agama.Storage1";
const OBJECT_PATH: &str = "/org/opensuse/Agama/Storage1";
const INTERFACE: &str = "org.opensuse.Agama.Storage1";

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
    ) -> oneshot::Receiver<Result<(), Error>>;
    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error>;
    async fn set_locale(&self, locale: String) -> Result<(), Error>;
}

/// D-Bus client for the storage service
#[derive(Clone)]
pub struct Client<'a> {
    connection: Connection,
    proxy: Storage1Proxy<'a>,
}

impl<'a> Client<'a> {
    pub async fn new(connection: Connection) -> Self {
        let proxy = Storage1Proxy::new(&connection).await.unwrap();
        proxy
            .config()
            .await
            .expect("Failed to read the storage D-Bus interface.");
        Self { connection, proxy }
    }

    async fn call<T: serde::ser::Serialize + zbus::zvariant::DynamicType>(
        &self,
        method: &str,
        body: &T,
    ) -> Result<Message, Error> {
        let bus = BusName::try_from(SERVICE_NAME.to_string())?;
        let path = OwnedObjectPath::try_from(OBJECT_PATH)?;
        self.connection
            .call_method(Some(&bus), &path, Some(INTERFACE), method, body)
            .await
            .map_err(|e| e.into())
    }
}

#[async_trait]
impl<'a> StorageClient for Client<'a> {
    async fn activate(&self) -> Result<(), Error> {
        self.call("Activate", &()).await?;
        Ok(())
    }

    async fn probe(&self) -> Result<(), Error> {
        self.call("Probe", &()).await?;
        Ok(())
    }

    async fn install(&self) -> Result<(), Error> {
        self.call("Install", &()).await?;
        Ok(())
    }

    async fn finish(&self) -> Result<(), Error> {
        self.call("Finish", &()).await?;
        Ok(())
    }

    async fn umount(&self) -> Result<(), Error> {
        self.call("Umount", &()).await?;
        Ok(())
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let raw_json = self.proxy.system().await?;
        try_from_string(&raw_json)
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let raw_json = self.proxy.config().await?;
        try_from_string(&raw_json)
    }

    async fn get_config_from_model(&self, model: Value) -> Result<Option<Config>, Error> {
        let raw_json = self.proxy.get_config_from_model(&model.to_string()).await?;
        try_from_string(&raw_json)
    }

    async fn get_config_model(&self) -> Result<Option<Value>, Error> {
        let raw_json = self.proxy.config_model().await?;
        try_from_string(&raw_json)
    }

    async fn get_proposal(&self) -> Result<Option<Value>, Error> {
        let raw_json = self.proxy.proposal().await?;
        try_from_string(&raw_json)
    }

    async fn get_issues(&self) -> Result<Vec<Issue>, Error> {
        let raw_json = self.proxy.issues().await?;
        try_from_string(&raw_json)
    }

    async fn set_config(
        &self,
        product: Arc<RwLock<ProductSpec>>,
        config: Option<Config>,
    ) -> oneshot::Receiver<Result<(), Error>> {
        let product = product.clone();
        let client = DBusClient::new(self.connection.clone());
        run_in_background(async move {
            let product_guard = product.read().await;
            let product_json = serde_json::to_string(&*product_guard)?;
            let config = config.filter(|c| c.has_value());
            let config_json = serde_json::to_string(&config)?;
            let result: Result<(), Error> = client
                .call("SetConfig", &(product_json, config_json))
                .await
                .map(|_| ());
            result
        })
    }

    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error> {
        let message = self.call("SolveConfigModel", &(model.to_string())).await?;
        try_from_message(message)
    }

    async fn set_locale(&self, locale: String) -> Result<(), Error> {
        self.call("SetLocale", &(locale)).await?;
        Ok(())
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

fn try_from_string<T: serde::de::DeserializeOwned + Default>(raw_json: &str) -> Result<T, Error> {
    let json: Value = serde_json::from_str(&raw_json)?;
    if json.is_null() {
        return Ok(T::default());
    }
    let value = serde_json::from_value(json)?;
    Ok(value)
}

fn try_from_message<T: serde::de::DeserializeOwned + Default>(
    message: Message,
) -> Result<T, Error> {
    let raw_json: String = message.body().deserialize()?;
    let json: Value = serde_json::from_str(&raw_json)?;
    if json.is_null() {
        return Ok(T::default());
    }
    let value = serde_json::from_value(json)?;
    Ok(value)
}

#[derive(Clone)]
pub struct DBusClient {
    connection: Connection,
}

impl DBusClient {
    pub fn new(connection: Connection) -> Self {
        Self { connection }
    }
    async fn call<T: serde::ser::Serialize + zbus::zvariant::DynamicType>(
        &self,
        method: &str,
        body: &T,
    ) -> Result<Message, Error> {
        let bus = BusName::try_from(SERVICE_NAME.to_string())?;
        let path = OwnedObjectPath::try_from(OBJECT_PATH)?;
        self.connection
            .call_method(Some(&bus), &path, Some(INTERFACE), method, body)
            .await
            .map_err(|e| e.into())
    }
}
