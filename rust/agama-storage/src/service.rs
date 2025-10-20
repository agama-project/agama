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

use crate::dbus::client::{self, Client};
use crate::message;
use agama_utils::actor::{self, Actor, MessageHandler};
use async_trait::async_trait;
use serde_json::value::RawValue;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error(transparent)]
    Client(#[from] client::Error),
}

/// Storage service.
pub struct Service {
    client: Client,
}

impl Service {
    pub fn new(connection: zbus::Connection) -> Service {
        Self {
            client: Client::new(connection),
        }
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetModel> for Service {
    async fn handle(&mut self, _message: message::GetModel) -> Result<Box<RawValue>, Error> {
        self.client.get_config_model().await.map_err(|e| e.into())
    }
}

#[async_trait]
impl MessageHandler<message::SetModel> for Service {
    async fn handle(&mut self, message: message::SetModel) -> Result<(), Error> {
        self.client
            .set_config_model(message.model)
            .await
            .map_err(|e| e.into())
    }
}
