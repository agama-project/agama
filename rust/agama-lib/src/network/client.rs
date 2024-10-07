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
use crate::base_http_client::BaseHTTPClient;
use crate::error::ServiceError;

/// HTTP/JSON client for the network service
pub struct NetworkClient {
    pub client: BaseHTTPClient,
}

impl NetworkClient {
    pub async fn new(client: BaseHTTPClient) -> Result<NetworkClient, ServiceError> {
        Ok(Self { client })
    }

    /// Returns an array of network devices
    pub async fn devices(&self) -> Result<Vec<Device>, ServiceError> {
        let json = self.client.get::<Vec<Device>>("/network/devices").await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, ServiceError> {
        let json = self
            .client
            .get::<Vec<NetworkConnection>>("/network/connections")
            .await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connection(&self, id: &str) -> Result<NetworkConnection, ServiceError> {
        let json = self
            .client
            .get::<NetworkConnection>(format!("/network/connections/{id}").as_str())
            .await?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn add_or_update_connection(
        &self,
        connection: NetworkConnection,
    ) -> Result<(), ServiceError> {
        let id = connection.id.clone();
        let response = self.connection(id.as_str()).await;

        if response.is_ok() {
            let path = format!("/network/connections/{id}");
            self.client.put_void(&path.as_str(), &connection).await?
        } else {
            self.client
                .post_void(format!("/network/connections").as_str(), &connection)
                .await?
        }

        Ok(())
    }

    /// Returns an array of network connections
    pub async fn apply(&self) -> Result<(), ServiceError> {
        // trying to be tricky here. If something breaks then we need a put method on
        // BaseHTTPClient which doesn't require a serialiable object for the body
        self.client
            .put_void(&format!("/network/system/apply").as_str(), &())
            .await?;

        Ok(())
    }
}
