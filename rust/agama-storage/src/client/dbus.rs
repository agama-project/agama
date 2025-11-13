// Copyright (c) [2025] SUSE LLC
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


use crate::client::{Error, StorageClient};
use agama_utils::api::{storage::Config, Issue};
use async_trait::async_trait;
use serde_json::Value;
use zbus::{names::BusName, zvariant::OwnedObjectPath, Connection, Message};

const SERVICE_NAME: &str = "org.opensuse.Agama.Storage1";
const OBJECT_PATH: &str = "/org/opensuse/Agama/Storage1";
const INTERFACE: &str = "org.opensuse.Agama.Storage1";

/// D-Bus client for the storage service
#[derive(Clone)]
pub struct Client {
    connection: Connection,
}

impl Client {
    pub fn new(connection: Connection) -> Self {
        Self { connection }
    }

    async fn call<T: serde::ser::Serialize + zbus::zvariant::DynamicType>(
        &self,
        method: &str,
        body: &T,
    ) -> Result<Message, zbus::Error> {
        let bus = BusName::try_from(SERVICE_NAME.to_string()).unwrap();
        let path = OwnedObjectPath::try_from(OBJECT_PATH).unwrap();
        self.connection
            .call_method(Some(&bus), &path, Some(INTERFACE), method, body)
            .await
    }
}

#[async_trait]
impl StorageClient for Client {
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

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let message = self.call("GetSystem", &()).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let message = self.call("GetConfig", &()).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    async fn get_config_model(&self) -> Result<Option<Value>, Error> {
        let message = self.call("GetConfigModel", &()).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    async fn get_proposal(&self) -> Result<Option<Value>, Error> {
        let message = self.call("GetProposal", &()).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    async fn get_issues(&self) -> Result<Vec<Issue>, Error> {
        let message = self.call("GetIssues", &()).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    //TODO: send a product config instead of an id.
    async fn set_product(&self, id: String) -> Result<(), Error> {
        self.call("SetProduct", &(id)).await?;
        Ok(())
    }

    async fn set_config(&self, config: Config) -> Result<(), Error> {
        let config = if config.has_value() { Some(config) } else { None };
        let json = serde_json::to_string(&config).unwrap();
        self.call("SetConfig", &(json)).await?;
        Ok(())
    }

    async fn set_config_model(&self, model: Value) -> Result<(), Error> {
        self.call("SetConfigModel", &(model.to_string())).await?;
        Ok(())
    }

    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error> {
        let message = self.call("SolveConfigModel", &(model.to_string())).await?;
        try_from_message(message).map_err(|e| e.into())
    }

    async fn set_locale(&self, locale: String) -> Result<(), Error> {
        self.call("SetLocale", &(locale)).await?;
        Ok(())
    }
}

fn try_from_message<T: serde::de::DeserializeOwned + Default>(
    message: Message,
) -> Result<T, Error> {
    let raw_json: String = message.body().deserialize()?;
    let json: Value = serde_json::from_str(&raw_json).unwrap();
    if json.is_null() {
        return Ok(T::default());
    }
    let value = serde_json::from_value(json).unwrap();
    Ok(value)
}
