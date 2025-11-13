
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

use super::{Error, StorageClient};
use agama_utils::api::{storage::Config, Issue};
use async_trait::async_trait;
use serde_json::Value;

#[derive(Clone, Default)]
pub struct MockClient;

#[async_trait]
impl StorageClient for MockClient {
    async fn activate(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn probe(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn install(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn finish(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        Ok(None)
    }

    async fn get_config_model(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_proposal(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_issues(&self) -> Result<Vec<Issue>, Error> {
        Ok(vec![])
    }

    async fn set_product(&self, _id: String) -> Result<(), Error> {
        Ok(())
    }

    async fn set_config(&self, _config: Config) -> Result<(), Error> {
        Ok(())
    }

    async fn set_config_model(&self, _model: Value) -> Result<(), Error> {
        Ok(())
    }

    async fn solve_config_model(&self, _model: Value) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn set_locale(&self, _locale: String) -> Result<(), Error> {
        Ok(())
    }
}
