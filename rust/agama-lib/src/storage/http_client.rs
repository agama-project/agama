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

//! Implements a client to access Agama's storage service.

pub mod dasd;
pub mod iscsi;
pub mod zfcp;

use crate::{
    http::{BaseHTTPClient, BaseHTTPClientError},
    storage::StorageSettings,
};

#[derive(Debug, thiserror::Error)]
pub enum StorageHTTPClientError {
    #[error(transparent)]
    Storage(#[from] BaseHTTPClientError),
}

pub struct StorageHTTPClient {
    client: BaseHTTPClient,
}

impl StorageHTTPClient {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self { client }
    }

    pub async fn get_config(&self) -> Result<Option<StorageSettings>, StorageHTTPClientError> {
        Ok(self.client.get("/storage/config").await?)
    }

    pub async fn set_config(&self, config: &StorageSettings) -> Result<(), StorageHTTPClientError> {
        Ok(self.client.put_void("/storage/config", config).await?)
    }

    pub async fn is_dirty(&self) -> Result<bool, StorageHTTPClientError> {
        Ok(self.client.get("/storage/devices/dirty").await?)
    }

    pub async fn reprobe(&self) -> Result<(), StorageHTTPClientError> {
        Ok(self.client.post_void("/storage/reprobe", &()).await?)
    }
}
