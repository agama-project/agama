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

//! Implements a client to access Agama's iscsi service.

use serde_json::value::RawValue;

use crate::{
    base_http_client::{BaseHTTPClient, BaseHTTPClientError},
    storage::StorageSettings,
};

#[derive(Debug, thiserror::Error)]
pub enum ISCSIHTTPClientError {
    #[error(transparent)]
    ISCSI(#[from] BaseHTTPClientError),
}

pub struct ISCSIHTTPClient {
    client: BaseHTTPClient,
}

impl ISCSIHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_config(&self) -> Result<Option<StorageSettings>, ISCSIHTTPClientError> {
        // TODO: implement it as part of next step
        //self.client.get("/storage/config").await
        Ok(None)
    }

    pub async fn set_config(&self, config: &Box<RawValue>) -> Result<(), ISCSIHTTPClientError> {
        Ok(self.client.post_void("/iscsi/config", config).await?)
    }
}
