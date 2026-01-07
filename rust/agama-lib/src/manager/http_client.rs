// Copyright (c) [2024-2025] SUSE LLC
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
    http::{BaseHTTPClient, BaseHTTPClientError},
    logs::LogsLists,
    manager::InstallerStatus,
};
use reqwest::header::CONTENT_ENCODING;
use std::path::{Path, PathBuf};
use std::{fs, io::Cursor, os::unix::fs::OpenOptionsExt};

use super::FinishMethod;

#[derive(Debug, thiserror::Error)]
pub enum ManagerHTTPClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
    #[error("Cannot generate Agama logs: {0}")]
    CannotGenerateLogs(String),
}

pub struct ManagerHTTPClient {
    client: BaseHTTPClient,
}
impl ManagerHTTPClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Starts a "probing".
    pub async fn probe(&self) -> Result<(), ManagerHTTPClientError> {
        // BaseHTTPClient did not anticipate POST without request body
        // so we pass () which is rendered as `null`
        Ok(self.client.post_void("/manager/probe_sync", &()).await?)
    }

    /// Starts a "reprobing".
    pub async fn reprobe(&self) -> Result<(), ManagerHTTPClientError> {
        // BaseHTTPClient did not anticipate POST without request body
        // so we pass () which is rendered as `null`
        Ok(self.client.post_void("/manager/reprobe_sync", &()).await?)
    }

    /// Starts the installation.
    pub async fn install(&self) -> Result<(), ManagerHTTPClientError> {
        Ok(self.client.post_void("/manager/install", &()).await?)
    }

    /// Finishes the installation.
    ///
    /// * `method`: halt, reboot, stop or poweroff the system.
    pub async fn finish(&self, method: FinishMethod) -> Result<bool, ManagerHTTPClientError> {
        let method = Some(method);
        Ok(self.client.post("/manager/finish", &method).await?)
    }

    /// Downloads package of logs from the backend
    ///
    /// For now the path is path to a destination file without an extension. Extension
    /// will be added according to the compression type found in the response
    ///
    /// Returns path to logs
    pub async fn store(&self, path: &Path) -> Result<PathBuf, ManagerHTTPClientError> {
        // 1) response with logs
        let response = self.client.get_raw("/v2/private/download_logs").await?;

        // 2) find out the destination file name
        let ext = &response.headers().get(CONTENT_ENCODING).ok_or(
            ManagerHTTPClientError::CannotGenerateLogs(String::from("Invalid response")),
        )?;
        let mut destination = path.to_path_buf();

        destination.set_extension(ext.to_str().map_err(|_| {
            ManagerHTTPClientError::CannotGenerateLogs(String::from("Invalid response"))
        })?);

        // 3) store response's binary content (logs) in a file
        let mut file = fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .mode(0o600)
            .open(&destination)
            .map_err(|_| {
                ManagerHTTPClientError::CannotGenerateLogs(String::from(
                    "Cannot store received response",
                ))
            })?;

        let mut content = Cursor::new(response.bytes().await.map_err(BaseHTTPClientError::HTTP)?);

        std::io::copy(&mut content, &mut file).map_err(|_| {
            ManagerHTTPClientError::CannotGenerateLogs(String::from(
                "Cannot store received response",
            ))
        })?;

        Ok(destination)
    }

    /// Asks backend for lists of log files and commands used for creating logs archive returned by
    /// store (/logs/store) backed HTTP API command
    pub async fn list(&self) -> Result<LogsLists, ManagerHTTPClientError> {
        Ok(self.client.get("/manager/logs/list").await?)
    }

    /// Returns the installer status.
    pub async fn status(&self) -> Result<InstallerStatus, ManagerHTTPClientError> {
        let status = self
            .client
            .get::<InstallerStatus>("/manager/installer")
            .await?;
        Ok(status)
    }
}
