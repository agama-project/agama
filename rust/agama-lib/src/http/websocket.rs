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

//! This module implements a WSClient to connect to Agama's WebSocket and
//! listen for events.

use tokio::{net::TcpStream, sync::broadcast};
use tokio_native_tls::native_tls;
use tokio_stream::StreamExt;
use tokio_tungstenite::{
    connect_async_tls_with_config,
    tungstenite::{
        http::{self, Uri},
        ClientRequestBuilder,
    },
    Connector, WebSocketStream,
};
use url::Url;

use super::OldEvent;
use crate::auth::AuthToken;

#[derive(Debug, thiserror::Error)]
pub enum WebSocketError {
    #[error(transparent)]
    Websocket(#[from] tokio_tungstenite::tungstenite::Error),
    #[error("The WebSocket is closed")]
    Closed,
    #[error(transparent)]
    Tls(#[from] tokio_native_tls::native_tls::Error),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error("TLS handshake error: {0}")]
    Handshake(String),
    #[error(transparent)]
    InvalidUri(#[from] http::uri::InvalidUri),
    #[error(transparent)]
    EventDeserialize(#[from] serde_json::Error),
    #[error("Missing hostname in {0}")]
    MissingHostname(String),
    #[error("Internal communication error: {0}")]
    RecvError(#[from] broadcast::error::RecvError),
}

/// WebSocket client for the Agama service.
pub struct WebSocketClient {
    socket: WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>,
}

impl WebSocketClient {
    /// Connects to a websocket using the given authentication token.
    ///
    /// * `url`: URL of the websocket to connect.
    /// * `auth_token`: Agama authentication token.
    /// * `insecure`: whether invalid certs and hostnames are allowed.
    pub async fn connect(
        url: &Url,
        auth_token: &AuthToken,
        insecure: bool,
    ) -> Result<Self, WebSocketError> {
        let tls_connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(insecure)
            .danger_accept_invalid_hostnames(insecure)
            .build()?;
        let tls_connector: native_tls::TlsConnector = tls_connector.into();

        let connector = Connector::NativeTls(tls_connector);
        let uri: Uri = url.as_str().parse()?;
        let token = auth_token.as_str();

        let request =
            ClientRequestBuilder::new(uri).with_header("Authorization", format!("Bearer {token}"));

        // The connect_async_tls_config receives a request, the WebSocket
        // configuration, whether to disable the "Nagle's algorithm"
        // (recommended to false) and the connector.
        //
        // See https://docs.rs/tokio-tungstenite/latest/tokio_tungstenite/fn.connect_async_tls_with_config.html.
        let (socket, _response) =
            connect_async_tls_with_config(request, None, false, Some(connector)).await?;

        Ok(Self { socket })
    }

    /// Receive an event from the websocket.
    ///
    /// It returns the message as an event.
    pub async fn receive_old_events(&mut self) -> Result<OldEvent, WebSocketError> {
        let msg = self.socket.next().await.ok_or(WebSocketError::Closed)?;
        let content = msg?.to_string();
        let event: OldEvent = serde_json::from_str(&content)?;
        Ok(event)
    }
}
