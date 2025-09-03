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

//! Implements a client to access Agama's DASD service.

use crate::{
    http::{BaseHTTPClient, BaseHTTPClientError},
    storage::settings::dasd::DASDConfig,
};

#[derive(Debug, thiserror::Error)]
pub enum DASDHTTPClientError {
    #[error(transparent)]
    DASD(#[from] BaseHTTPClientError),
}

pub struct DASDHTTPClient {
    client: BaseHTTPClient,
}

impl DASDHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<Option<DASDConfig>, DASDHTTPClientError> {
        let config: DASDConfig = self.client.get("/storage/dasd/config").await?;
        // without any dasd devices config is nothing
        if config.devices.is_empty() {
            Ok(None)
        } else {
            Ok(Some(config))
        }
    }

    pub async fn set_config(&self, config: &DASDConfig) -> Result<(), DASDHTTPClientError> {
        if !self.supported().await? {
            // TODO: should we add tracing error here?
            return Ok(());
        }
        Ok(self.client.put_void("/storage/dasd/config", config).await?)
    }

    pub async fn supported(&self) -> Result<bool, DASDHTTPClientError> {
        Ok(self.client.get("/storage/dasd/supported").await?)
    }
}
