use super::settings::{BondSettings, MatchSettings, NetworkConnection, WirelessSettings};
use super::types::{Device, DeviceState, DeviceType, SSID};
use crate::error::ServiceError;
use reqwest::cookie::CookieStore;
use reqwest::{header, ClientBuilder};
use reqwest::{Client, Error, Response};
use serde_json;
use std::collections::HashMap;
use tokio_stream::StreamExt;

const API_URL: &str = "http://localhost:3000/api/network";

/// HTTP/JSON client for the network service
pub struct NetworkClient {
    pub client: Client,
}

impl NetworkClient {
    pub async fn new(client: Client) -> Result<NetworkClient, ServiceError> {
        Ok(Self { client })
    }

    async fn get(&self, path: &str) -> Result<String, ServiceError> {
        let response = self
            .client
            .get(format!("{API_URL}{path}"))
            .send()
            .await
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        let status = response.status().clone();
        let text = response
            .text()
            .await
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        if status != 200 {
            return Err(ServiceError::NetworkClientError((text)));
        }

        Ok(text)
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
        let json = serde_json::to_string(&connection)
            .map_err(|e| ServiceError::NetworkClientError(e.to_string()))?;

        let response = self.connection(id.as_str()).await;

        if let Ok(response) = response {
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
