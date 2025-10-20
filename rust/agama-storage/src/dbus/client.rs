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

use serde_json::value::RawValue;
use std::collections::HashMap;
use zbus::{
    names::BusName,
    zvariant::{self, OwnedObjectPath},
    Connection,
};

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

    pub async fn get_config_model(&self) -> Result<Box<RawValue>, Error> {
        self.get_json("GetConfigModel").await
    }

    pub async fn set_config_model(&self, model: Box<RawValue>) -> Result<(), Error> {
        self.set_json("SetConfigModel", model).await
    }

    async fn get_json(&self, method: &str) -> Result<Box<RawValue>, Error> {
        let bus = BusName::try_from(SERVICE_NAME.to_string())?;
        let path = OwnedObjectPath::try_from(OBJECT_PATH)?;
        let message = self
            .connection
            .call_method(Some(&bus), &path, Some(INTERFACE), method, &())
            .await?;

        let value: String = message.body().deserialize()?;
        RawValue::from_string(value).map_err(|e| e.into())
    }

    async fn set_json(&self, method: &str, json: Box<RawValue>) -> Result<(), Error> {
        let bus = BusName::try_from(SERVICE_NAME.to_string())?;
        let path = OwnedObjectPath::try_from(OBJECT_PATH)?;
        let data: HashMap<&str, &zvariant::Value> = HashMap::new();
        self.connection
            .call_method(
                Some(&bus),
                &path,
                Some(INTERFACE),
                method,
                &(json.to_string(), data),
            )
            .await?;

        Ok(())
    }
}
