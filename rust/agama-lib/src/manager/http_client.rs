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

use crate::{
    base_http_client::{BaseHTTPClient, BaseHTTPClientError},
    logs::LogsLists,
    manager::InstallerStatus,
};
use reqwest::header::CONTENT_ENCODING;
use std::io::Cursor;
use std::path::{Path, PathBuf};

pub struct ManagerHTTPClient {
    client: BaseHTTPClient,
}

impl ManagerHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Starts a "probing".
    pub async fn probe(&self) -> Result<(), BaseHTTPClientError> {
        // BaseHTTPClient did not anticipate POST without request body
        // so we pass () which is rendered as `null`
        self.client.post_void("/manager/probe_sync", &()).await
    }

    /// Downloads package of logs from the backend
    ///
    /// For now the path is path to a destination file without an extension. Extension
    /// will be added according to the compression type found in the response
    ///
    /// Returns path to logs
    pub async fn store(&self, path: &Path) -> Result<PathBuf, BaseHTTPClientError> {
        // 1) response with logs
        let response = self.client.get_raw("/manager/logs/store").await?;

        // 2) find out the destination file name
        let ext =
            &response
                .headers()
                .get(CONTENT_ENCODING)
                .ok_or(BaseHTTPClientError::MissingHeader(
                    CONTENT_ENCODING.to_string(),
                ))?;
        let mut destination = path.to_path_buf();

        destination.set_extension(ext.to_str()?);

        // 3) store response's binary content (logs) in a file
        let mut file = std::fs::File::create(destination.as_path())?;
        let mut content = Cursor::new(response.bytes().await?);

        std::io::copy(&mut content, &mut file)?;

        Ok(destination)
    }

    /// Asks backend for lists of log files and commands used for creating logs archive returned by
    /// store (/logs/store) backed HTTP API command
    pub async fn list(&self) -> Result<LogsLists, BaseHTTPClientError> {
        self.client.get("/manager/logs/list").await
    }

    /// Returns the installer status.
    pub async fn status(&self) -> Result<InstallerStatus, BaseHTTPClientError> {
        self.client
            .get::<InstallerStatus>("/manager/installer")
            .await
    }
}
