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

//! This module implements a service that retrieves and keeps the information
//! from an Agama's server.
//!
//! It follows an actor-based approach, like other modules from our `api-v2`
//! branch.

use agama_lib::http::BaseHTTPClient;
use agama_utils::api::{Config, SystemInfo};

/// Interface to the Agama API.
///
/// In the future, it might listen for changes and update its status automatically.
/// At this point, the App struct is responsible for that when it receives an event.
pub struct ApiState {
    pub system_info: SystemInfo,
    pub config: Config,
    http: BaseHTTPClient,
}

impl ApiState {
    pub async fn from_api(http: &BaseHTTPClient) -> anyhow::Result<Self> {
        let system_info = http.get::<SystemInfo>("v2/system").await?;
        let config = http.get::<Config>("v2/config").await?;

        Ok(Self {
            system_info,
            config,
            http: http.clone(),
        })
    }

    pub async fn update_system_info(&mut self) -> anyhow::Result<()> {
        self.system_info = self.http.get("v2/system").await?;
        Ok(())
    }

    pub async fn update_config(&mut self) -> anyhow::Result<()> {
        self.config = self.http.get("v2/config").await?;
        Ok(())
    }
}
