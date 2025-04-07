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

//! Implements the store for the bootloader settings.

use crate::base_http_client::BaseHTTPClient;
use crate::error::ServiceError;

use super::http_client::BootloaderHTTPClient;
use super::model::BootloaderSettings;

/// Loads and stores the bootloader settings from/to the HTTP service.
pub struct BootloaderStore {
    bootloader_client: BootloaderHTTPClient,
}

impl BootloaderStore {
    pub fn new(client: BaseHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self {
            bootloader_client: BootloaderHTTPClient::new(client),
        })
    }

    pub async fn load(&self) -> Result<Option<BootloaderSettings>, ServiceError> {
        Ok(self.bootloader_client.get_config().await?.to_option())

    }

    pub async fn store(&self, settings: &BootloaderSettings) -> Result<(), ServiceError> {
        self.bootloader_client.set_config(settings).await?;
        Ok(())
    }
}
