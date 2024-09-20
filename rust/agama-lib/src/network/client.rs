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
use crate::error::ServiceError;
use reqwest::{Client, Response};
use serde_json;

const API_URL: &str = "http://localhost/api/network";

/// HTTP/JSON client for the network service
pub struct NetworkClient {
    pub client: Client,
}

impl NetworkClient {
    pub async fn new(client: Client) -> Result<NetworkClient, ServiceError> {
        Ok(Self { client })
    }

    async fn text_for(&self, response: Response) -> Result<String, ServiceError> {
        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        if status != 200 {
            return Err(ServiceError::NetworkClientError(text));
        }

        Ok(text)
    }

    async fn get(&self, path: &str) -> Result<String, ServiceError> {
        let response = self
            .client
            .get(format!("{API_URL}{path}"))
            .send()
            .await
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        self.text_for(response).await
    }

    /// Returns an array of network devices
    pub async fn devices(&self) -> Result<Vec<Device>, ServiceError> {
        let text = self.get("/devices").await?;

        let json: Vec<Device> = serde_json::from_str(&text)
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connections(&self) -> Result<Vec<NetworkConnection>, ServiceError> {
        let text = self.get("/connections").await?;

        let json: Vec<NetworkConnection> = serde_json::from_str(&text)
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        Ok(json)
    }

    /// Returns an array of network connections
    pub async fn connection(&self, id: &str) -> Result<NetworkConnection, ServiceError> {
        let text = self.get(format!("/connections/{id}").as_str()).await?;
        let json: NetworkConnection = serde_json::from_str(&text)
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

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
            let path = format!("{API_URL}/connections/{id}");
            self.client
                .put(path)
                .json(&connection)
                .send()
                .await
                .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;
        } else {
            self.client
                .post(format!("{API_URL}/connections").as_str())
                .json(&connection)
                .send()
                .await
                .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;
        }

        Ok(())
    }

    /// Returns an array of network connections
    pub async fn apply(&self) -> Result<(), ServiceError> {
        self.client
            .put(format!("{API_URL}/system/apply"))
            .send()
            .await
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        Ok(())
    }
}
