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

//! Implements the store for the files settings.

use super::{
    client::{FilesClient, FilesHTTPClientError},
    model::UserFile,
};
use crate::{
    base_http_client::BaseHTTPClient,
    file_source::{FileSourceError, WithFileSource},
    StoreContext,
};

#[derive(Debug, thiserror::Error)]
pub enum FilesStoreError {
    #[error("Error processing files settings: {0}")]
    FilesHTTPClient(#[from] FilesHTTPClientError),
    #[error(transparent)]
    FileSourceError(#[from] FileSourceError),
}

type FilesStoreResult<T> = Result<T, FilesStoreError>;

/// Loads and stores the files settings from/to the HTTP service.
pub struct FilesStore {
    files_client: FilesClient,
}

impl FilesStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            files_client: FilesClient::new(client),
        }
    }

    /// loads the list of user files from http API
    pub async fn load(&self) -> FilesStoreResult<Option<Vec<UserFile>>> {
        let res = self.files_client.get_files().await?;
        if res.is_empty() {
            Ok(None)
        } else {
            Ok(Some(res))
        }
    }

    /// stores the list of user files via http API
    pub async fn store(
        &self,
        files: &Vec<UserFile>,
        context: &StoreContext,
    ) -> FilesStoreResult<()> {
        let resolved_files = files
            .iter()
            .map(|f| f.resolve_url(&context.source))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(self.files_client.set_files(&resolved_files).await?)
    }
}
