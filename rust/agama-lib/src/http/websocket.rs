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

use agama_utils::api::Event;
use std::time::Duration;
use tokio::{net::TcpStream, sync::broadcast};
use tokio_native_tls::native_tls;
use tokio_stream::StreamExt;
use tokio_tungstenite::{
    client_async_tls_with_config,
    tungstenite::{
        http::{self, Uri},
        ClientRequestBuilder, Message,
    },
    Connector, WebSocketStream,
};
use url::Url;

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
#[derive(Debug)]
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
        let host = url
            .host_str()
            .ok_or_else(|| WebSocketError::MissingHostname(url.to_string()))?;
        let port = url
            .port()
            .unwrap_or(if url.scheme() == "wss" { 443 } else { 80 });

        // Manually create TCP socket to enable keepalive
        let tcp_stream = TcpStream::connect((host, port)).await?;

        // Enable TCP keepalive to detect broken connections
        // This will cause recv() to fail if the connection is dead
        let socket_ref = socket2::SockRef::from(&tcp_stream);
        let keepalive = socket2::TcpKeepalive::new()
            .with_time(Duration::from_secs(30)) // Send first probe after 30s of inactivity
            .with_interval(Duration::from_secs(10)); // Send probes every 10s
        socket_ref.set_tcp_keepalive(&keepalive)?;

        let tls_connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(insecure)
            .danger_accept_invalid_hostnames(insecure)
            .build()?;

        let connector = Connector::NativeTls(tls_connector);
        let uri: Uri = url.as_str().parse()?;
        let token = auth_token.as_str();

        let request =
            ClientRequestBuilder::new(uri).with_header("Authorization", format!("Bearer {token}"));

        // Upgrade the TCP stream to WebSocket
        let (socket, _response) =
            client_async_tls_with_config(request, tcp_stream, None, Some(connector)).await?;

        Ok(Self { socket })
    }

    /// Receive an event from the websocket.
    ///
    /// It returns the message as an event. Ping/Pong frames are handled
    /// automatically and filtered out. If the connection breaks, this will
    /// return an error (thanks to TCP keepalive).
    pub async fn receive(&mut self) -> Result<Event, WebSocketError> {
        loop {
            let msg = self.socket.next().await.ok_or(WebSocketError::Closed)??;

            match msg {
                Message::Text(text) => {
                    let event: Event = serde_json::from_str(&text)?;
                    return Ok(event);
                }
                Message::Binary(bytes) => {
                    let text = String::from_utf8_lossy(&bytes);
                    let event: Event = serde_json::from_str(&text)?;
                    return Ok(event);
                }
                Message::Ping(_) | Message::Pong(_) => {
                    // Tungstenite automatically handles ping/pong, just skip
                    continue;
                }
                Message::Close(_) => {
                    return Err(WebSocketError::Closed);
                }
                Message::Frame(_) => {
                    // Raw frames shouldn't appear in normal usage
                    continue;
                }
            }
        }
    }
}
