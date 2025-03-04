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

use crate::base_http_client::BaseHTTPClient;
use crate::ServiceError;

use super::model::FileSettings;

pub struct FilesClient {
    client: BaseHTTPClient,
}

impl FilesClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    pub async fn get_files(&self) -> Result<Vec<FileSettings>, ServiceError> {
        self.client.get("/files").await
    }

    pub async fn set_files(&self, config: &Vec<FileSettings>) -> Result<(), ServiceError> {
        self.client.put_void("/files", config).await
    }

    pub async fn write_files(&self) -> Result<(), ServiceError> {
        self.client.post_void("/files/write", &()).await
    }
}
