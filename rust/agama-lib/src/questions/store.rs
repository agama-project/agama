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

use crate::http::BaseHTTPClient;

use super::{
    config::QuestionsConfig,
    http_client::{HTTPClient as QuestionsHTTPClient, QuestionsHTTPClientError},
};

#[derive(Debug, thiserror::Error)]
#[error("Error processing questions settings: {0}")]
pub struct QuestionsStoreError(#[from] QuestionsHTTPClientError);

type QuestionsStoreResult<T> = Result<T, QuestionsStoreError>;

/// Loads and stores the questions settings from/to the HTTP API.
pub struct QuestionsStore {
    questions_client: QuestionsHTTPClient,
}

impl QuestionsStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            questions_client: QuestionsHTTPClient::new(client),
        }
    }

    pub async fn load(&self) -> QuestionsStoreResult<Option<QuestionsConfig>> {
        Ok(None)
    }

    pub async fn store(&self, config: &QuestionsConfig) -> QuestionsStoreResult<()> {
        Ok(self.questions_client.set_config(config).await?)
    }
}
