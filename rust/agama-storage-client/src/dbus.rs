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

use agama_utils::{api::storage::Config, products::ProductSpec};
use serde_json::Value;
use zbus::{names::BusName, zvariant::OwnedObjectPath, Message};

const SERVICE_NAME: &str = "org.opensuse.Agama.Storage1";
const OBJECT_PATH: &str = "/org/opensuse/Agama/Storage1";
const INTERFACE: &str = "org.opensuse.Agama.Storage1";

#[derive(thiserror::Error, Debug)]
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

/// Generic client for the storage D-Bus service.
#[derive(Clone)]
pub struct StorageDBusClient {
    connection: zbus::Connection,
}

impl StorageDBusClient {
    pub fn new(connection: zbus::Connection) -> Self {
        Self { connection }
    }

    pub async fn call_action(&self, action: String) -> Result<(), Error> {
        self.call(&action, &()).await?;
        Ok(())
    }

    /// Sets the storage configuration.
    pub async fn set_storage_config(
        &self,
        product: &ProductSpec,
        config: Option<Config>,
    ) -> Result<(), Error> {
        let product_json = serde_json::to_string(&*product)?;
        let config = config.filter(|c| c.has_value());
        let config_json = serde_json::to_string(&config)?;
        self.call("SetConfig", &(product_json, config_json)).await?;
        Ok(())
    }

    pub async fn set_bootloader_config(&self, config: serde_json::Value) -> Result<(), Error> {
        self.call("SetConfig", &(config.to_string())).await?;
        Ok(())
    }

    /// Solves the configuration model.
    pub async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error> {
        let message = self.call("SolveConfigModel", &(model.to_string())).await?;
        try_from_message(message)
    }

    pub async fn set_locale(&self, locale: String) -> Result<(), Error> {
        self.call("SetLocale", &(locale)).await?;
        Ok(())
    }

    /// Calls the given method on the `org.opensuse.Agama.Storage1` interaface.
    pub async fn call<T: serde::ser::Serialize + zbus::zvariant::DynamicType>(
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

fn try_from_message<T: serde::de::DeserializeOwned + Default>(
    message: Message,
) -> Result<T, Error> {
    let raw_json: String = message.body().deserialize()?;
    Ok(try_from_string(&raw_json)?)
}

/// Converts a string into a Value.
///
/// If the string is "null", return the default value.
pub fn try_from_string<T: serde::de::DeserializeOwned + Default>(
    raw_json: &str,
) -> Result<T, Error> {
    let json: serde_json::Value = serde_json::from_str(&raw_json)?;
    if json.is_null() {
        return Ok(T::default());
    }
    let value = serde_json::from_value(json)?;
    Ok(value)
}
