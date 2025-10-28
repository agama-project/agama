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

//! Implements a client to access Agama's storage service.

use agama_utils::api::storage::Config;
use serde_json::{value::RawValue, Value};
use zbus::{names::BusName, zvariant::OwnedObjectPath, Connection, Message};

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

/// D-Bus client for the storage service
#[derive(Clone)]
pub struct Client {
    connection: Connection,
}

impl Client {
    pub fn new(connection: Connection) -> Self {
        Self { connection }
    }

    pub async fn activate(&self) -> Result<(), Error> {
        self.call("Activate", &()).await?;
        Ok(())
    }

    pub async fn probe(&self) -> Result<(), Error> {
        self.call("Probe", &()).await?;
        Ok(())
    }

    pub async fn install(&self) -> Result<(), Error> {
        self.call("Install", &()).await?;
        Ok(())
    }

    pub async fn finish(&self) -> Result<(), Error> {
        self.call("Finish", &()).await?;
        Ok(())
    }

    pub async fn get_system(&self) -> Result<Option<Box<RawValue>>, Error> {
        let message = self.call("GetSystem", &()).await?;
        self.json_from(message)
    }

    pub async fn get_config(&self) -> Result<Option<Config>, Error> {
        let message = self.call("GetConfig", &()).await?;
        let value: String = message.body().deserialize()?;
        let config = serde_json::from_str(value.as_str())?;
        Ok(config)
    }

    pub async fn get_config_model(&self) -> Result<Option<Box<RawValue>>, Error> {
        let message = self.call("GetConfigModel", &()).await?;
        self.json_from(message)
    }

    pub async fn get_proposal(&self) -> Result<Option<Box<RawValue>>, Error> {
        let message = self.call("GetProposal", &()).await?;
        self.json_from(message)
    }

    pub async fn get_issues(&self) -> Result<Option<Box<RawValue>>, Error> {
        let message = self.call("GetIssues", &()).await?;
        self.json_from(message)
    }

    //TODO: send a product config instead of an id.
    pub async fn set_product(&self, id: String) -> Result<(), Error> {
        self.call("SetProduct", &(id)).await?;
        Ok(())
    }

    pub async fn set_config(&self, config: Box<RawValue>) -> Result<(), Error> {
        self.call("SetConfig", &(config.to_string())).await?;
        Ok(())
    }

    pub async fn set_config_model(&self, model: Box<RawValue>) -> Result<(), Error> {
        self.call("SetConfigModel", &(model.to_string())).await?;
        Ok(())
    }

    pub async fn solve_config_model(
        &self,
        model: Box<RawValue>,
    ) -> Result<Option<Box<RawValue>>, Error> {
        let message = self.call("SolveConfigModel", &(model.to_string())).await?;
        self.json_from(message)
    }

    pub async fn set_locale(&self, locale: String) -> Result<(), Error> {
        self.call("SetLocale", &(locale)).await?;
        Ok(())
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

    fn json_from(&self, message: Message) -> Result<Option<Box<RawValue>>, Error> {
        let value: String = message.body().deserialize()?;
        if self.is_null(value.as_str()) {
            return Ok(None);
        }
        let json = RawValue::from_string(value)?;
        Ok(Some(json))
    }

    fn is_null(&self, value: &str) -> bool {
        match serde_json::from_str::<Value>(value) {
            Ok(Value::Null) => true,
            Ok(_) => false,
            Err(_) => false,
        }
    }
}
