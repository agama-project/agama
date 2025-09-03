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

use super::{settings::NetworkConnection, types::Device};
use crate::http::{BaseHTTPClient, BaseHTTPClientError};
use crate::utils::url::encode;

#[derive(Debug, thiserror::Error)]
pub enum NetworkClientError {
    #[error(transparent)]
    HTTP(#[from] BaseHTTPClientError),
}

/// HTTP/JSON client for the network service
pub struct NetworkClient {
    pub client: BaseHTTPClient,
}

impl NetworkClient {
    pub fn new(base: BaseHTTPClient) -> Self {
        Self { client: base }
    }

    /// Returns an array of network devices
    pub async fn devices(&self) -> Result<Vec<Device>, NetworkClientError> {
        let json = self.client.get::<Vec<Device>>("/network/devices").await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, NetworkClientError> {
        let json = self
            .client
            .get::<Vec<NetworkConnection>>("/network/connections")
            .await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connection(&self, id: &str) -> Result<NetworkConnection, NetworkClientError> {
        let encoded_id = encode(id);
        let json = self
            .client
            .get::<NetworkConnection>(format!("/network/connections/{encoded_id}").as_str())
            .await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn add_or_update_connection(
        &self,
        connection: NetworkConnection,
    ) -> Result<(), NetworkClientError> {
        let id = connection.id.clone();
        let encoded_id = encode(id.as_str());
        let response = self.connection(id.as_str()).await;

        if response.is_ok() {
            let path = format!("/network/connections/{encoded_id}");
            self.client.put_void(path.as_str(), &connection).await?
        } else {
            self.client
                .post_void("/network/connections".to_string().as_str(), &connection)
                .await?
        }

        Ok(())
    }

    /// Returns an array of network connections
    pub async fn apply(&self) -> Result<(), NetworkClientError> {
        // trying to be tricky here. If something breaks then we need a put method on
        // BaseHTTPClient which doesn't require a serialiable object for the body
        self.client
            .post_void("/network/system/apply".to_string().as_str(), &())
            .await?;

        Ok(())
    }
}
