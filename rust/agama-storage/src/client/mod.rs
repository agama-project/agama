
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

use agama_utils::api::{storage::Config, Issue};
use async_trait::async_trait;
use serde_json::Value;

pub mod dbus;
pub mod mock;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("D-Bus error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("D-Bus FDO error: {0}")]
    DBusFdo(#[from] zbus::fdo::Error),
    #[error("D-Bus variant error: {0}")]
    DBusVariant(#[from] zbus::zvariant::Error),
}

#[async_trait]
pub trait StorageClient: Send + Sync {
    async fn activate(&self) -> Result<(), Error>;
    async fn probe(&self) -> Result<(), Error>;
    async fn install(&self) -> Result<(), Error>;
    async fn finish(&self) -> Result<(), Error>;
    async fn get_system(&self) -> Result<Option<Value>, Error>;
    async fn get_config(&self) -> Result<Option<Config>, Error>;
    async fn get_config_model(&self) -> Result<Option<Value>, Error>;
    async fn get_proposal(&self) -> Result<Option<Value>, Error>;
    async fn get_issues(&self) -> Result<Vec<Issue>, Error>;
    async fn set_product(&self, id: String) -> Result<(), Error>;
    async fn set_config(&self, config: Config) -> Result<(), Error>;
    async fn set_config_model(&self, model: Value) -> Result<(), Error>;
    async fn solve_config_model(&self, model: Value) -> Result<Option<Value>, Error>;
    async fn set_locale(&self, locale: String) -> Result<(), Error>;
}
