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

use zbus::Connection;

use crate::{
    bootloader::{model::BootloaderSettings, proxies::BootloaderProxy},
    error::ServiceError,
};

/// Client to connect to Agama's D-Bus API for Bootloader management.
#[derive(Clone)]
pub struct BootloaderClient<'a> {
    bootloader_proxy: BootloaderProxy<'a>,
}

impl<'a> BootloaderClient<'a> {
    pub async fn new(connection: Connection) -> Result<BootloaderClient<'a>, ServiceError> {
        let bootloader_proxy = BootloaderProxy::new(&connection).await?;

        Ok(Self { bootloader_proxy })
    }

    pub async fn get_config(&self) -> Result<BootloaderSettings, ServiceError> {
        let serialized_string = self.bootloader_proxy.get_config().await?;
        let settings = serde_json::from_str(serialized_string.as_str())?;
        Ok(settings)
    }

    pub async fn set_config(&self, config: &BootloaderSettings) -> Result<(), ServiceError> {
        // ignore return value as currently it does not fail and who knows what future brings
        // but it should not be part of result and instead transformed to ServiceError
        self.bootloader_proxy
            .set_config(serde_json::to_string(config)?.as_str())
            .await?;
        Ok(())
    }
}
