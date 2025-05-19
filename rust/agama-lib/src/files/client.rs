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

use super::model::UserFile;
use crate::http::{BaseHTTPClient, BaseHTTPClientError};

#[derive(Debug, thiserror::Error)]
pub enum FilesHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
}

pub struct FilesClient {
    client: BaseHTTPClient,
}

impl FilesClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// returns list of files that will be manually deployed
    pub async fn get_files(&self) -> Result<Vec<UserFile>, FilesHTTPClientError> {
        Ok(self.client.get("/files").await?)
    }

    /// Sets the list of files that will be manually deployed
    pub async fn set_files(&self, config: &Vec<UserFile>) -> Result<(), FilesHTTPClientError> {
        Ok(self.client.put_void("/files", config).await?)
    }

    /// writes the files to target
    pub async fn write_files(&self) -> Result<(), FilesHTTPClientError> {
        Ok(self.client.post_void("/files/write", &()).await?)
    }
}
