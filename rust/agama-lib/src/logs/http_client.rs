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

use crate::logs::LogsLists;
use crate::{base_http_client::BaseHTTPClient, error::ServiceError};
use reqwest::header::CONTENT_ENCODING;
use std::io::Cursor;
use std::path::{Path, PathBuf};

pub struct HTTPClient {
    client: BaseHTTPClient,
}

impl HTTPClient {
    pub fn new(client: BaseHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self { client })
    }

    /// Downloads package of logs from the backend
    ///
    /// For now the path is path to a destination file without an extension. Extension
    /// will be added according to the compression type found in the response
    ///
    /// Returns path to logs
    pub async fn store(&self, path: &Path) -> Result<PathBuf, ServiceError> {
        // 1) response with logs
        let response = self.client.get_binary("/logs/store").await?;

        // 2) find out the destination file name
        let ext =
            &response
                .headers()
                .get(CONTENT_ENCODING)
                .ok_or(ServiceError::CannotGenerateLogs(String::from(
                    "Invalid response",
                )))?;
        let mut destination = path.to_path_buf();

        destination.set_extension(
            ext.to_str()
                .map_err(|_| ServiceError::CannotGenerateLogs(String::from("Invalid response")))?,
        );

        // 3) store response's binary content (logs) in a file
        let mut file = std::fs::File::create(destination.as_path()).map_err(|_| {
            ServiceError::CannotGenerateLogs(String::from("Cannot store received response"))
        })?;
        let mut content = Cursor::new(response.bytes().await?);

        std::io::copy(&mut content, &mut file).map_err(|_| {
            ServiceError::CannotGenerateLogs(String::from("Cannot store received response"))
        })?;

        Ok(destination)
    }

    /// Asks backend for lists of log files and commands used for creating logs archive returned by
    /// store (/logs/store) backed HTTP API command
    pub async fn list(&self) -> Result<LogsLists, ServiceError> {
        Ok(self.client.get("/logs/list").await?)
    }
}
