// Copyright (c) [2024] SUSE LLC
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

use std::collections::HashMap;

use agama_storage_client::message;
use agama_utils::{actor::Handler, api::bootloader::Config};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// Errors that can occur when using the Bootloader client.
#[derive(thiserror::Error, Debug)]
pub enum Error {
    /// Error originating from the D-Bus communication.
    #[error("D-Bus service error: {0}")]
    DBus(#[from] zbus::Error),
    /// Error parsing or generating JSON data.
    #[error("Passed json data is not correct: {0}")]
    InvalidJson(#[from] serde_json::Error),
    #[error("Storage D-Bus server error: {0}")]
    DBusClient(#[from] agama_storage_client::Error),
}

/// Trait defining the interface for the Bootloader client.
///
/// This trait abstracts the operations available for managing the bootloader configuration
/// via the Agama D-Bus API. For testing purpose it can be replaced by mock object.
#[async_trait]
pub trait BootloaderClient {
    /// Retrieves the current bootloader configuration.
    async fn get_config(&self) -> ClientResult<Config>;
    /// Sets the bootloader configuration.
    async fn set_config(&self, config: &Config) -> ClientResult<()>;
    /// Sets the extra kernel args for given scope.
    ///
    /// * `id`: identifier of the kernel argument so it can be later changed.
    /// * `value`: plaintext value that will be appended to kernel commandline.
    async fn set_kernel_arg(&mut self, id: String, value: String);
}

// full config used on dbus which beside public config passes
// also additional internal settings
#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct FullConfig {
    #[serde(flatten)]
    config: Config,
    kernel_args: HashMap<String, String>,
}

pub type ClientResult<T> = Result<T, Error>;

/// Client to connect to Agama's D-Bus API for Bootloader management.
#[derive(Clone)]
pub struct Client {
    storage_dbus: Handler<agama_storage_client::Service>,
    kernel_args: HashMap<String, String>,
}

impl Client {
    pub async fn new(storage_dbus: Handler<agama_storage_client::Service>) -> ClientResult<Client> {
        Ok(Self {
            storage_dbus,
            kernel_args: HashMap::new(),
        })
    }
}

#[async_trait]
impl BootloaderClient for Client {
    async fn get_config(&self) -> ClientResult<Config> {
        Ok(self
            .storage_dbus
            .call(message::bootloader::GetConfig)
            .await?)
    }

    async fn set_config(&self, config: &Config) -> ClientResult<()> {
        let full_config = FullConfig {
            config: config.clone(),
            kernel_args: self.kernel_args.clone(),
        };
        tracing::info!("sending bootloader config {:?}", full_config);
        // ignore return value as currently it does not fail and who knows what future brings
        // but it should not be part of result and instead transformed to Issue
        let value = serde_json::to_value(&full_config)?;
        _ = self
            .storage_dbus
            .call(message::bootloader::SetConfig::new(value))
            .await;
        Ok(())
    }

    async fn set_kernel_arg(&mut self, id: String, value: String) {
        self.kernel_args.insert(id, value);
    }
}
