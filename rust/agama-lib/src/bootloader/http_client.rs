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

//! Implements a client to access Agama's HTTP API related to Bootloader management.

use crate::{
    base_http_client::{BaseHTTPClient, BaseHTTPClientError},
    bootloader::model::BootloaderSettings,
};

#[derive(Debug, thiserror::Error)]
pub enum BootloaderHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
}

pub struct BootloaderHTTPClient {
    client: BaseHTTPClient,
}

impl BootloaderHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<BootloaderSettings, BootloaderHTTPClientError> {
        Ok(self.client.get("/bootloader/config").await?)
    }

    pub async fn set_config(
        &self,
        config: &BootloaderSettings,
    ) -> Result<(), BootloaderHTTPClientError> {
        Ok(self.client.put_void("/bootloader/config", config).await?)
    }
}
