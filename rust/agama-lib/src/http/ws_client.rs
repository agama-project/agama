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

use native_tls::{TlsConnector, TlsStream};
/// Should we use Tokio?
use std::net::TcpStream;
use tungstenite::{
    client,
    http::{self, Uri},
    ClientRequestBuilder, WebSocket,
};
use url::Url;

use super::Event;
use crate::auth::AuthToken;

#[derive(Debug, thiserror::Error)]
pub enum WSClientError {
    #[error(transparent)]
    Websocket(#[from] tungstenite::Error),
    #[error(transparent)]
    Tls(#[from] native_tls::Error),
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
}

pub struct WSClient {
    socket: WebSocket<TlsStream<TcpStream>>,
}

impl WSClient {
    /// Connects to a websocket using the given authentication token.
    ///
    /// * `url`: URL of the websocket to connect.
    /// * `auth_token`: Agama authentication token.
    /// * `insecure`: whether invalid certs and hostnames are allowed.
    pub fn connect(
        url: &Url,
        auth_token: AuthToken,
        insecure: bool,
    ) -> Result<Self, WSClientError> {
        let host = url
            .host_str()
            .ok_or_else(|| WSClientError::MissingHostname(url.to_string()))?;
        let port = Self::find_port(&url);

        let tls_connector = TlsConnector::builder()
            .danger_accept_invalid_certs(insecure)
            .danger_accept_invalid_hostnames(insecure)
            .build()?;

        let socket_addr = format!("{}:{}", host, port);
        let stream = TcpStream::connect(socket_addr)?;
        let stream = tls_connector
            .connect(host, stream)
            .map_err(|e| WSClientError::Handshake(e.to_string()))?;

        let uri: Uri = url.as_str().parse()?;
        let token = auth_token.as_str();
        let request =
            ClientRequestBuilder::new(uri).with_header("Authorization", format!("Bearer {token}"));

        let (socket, _response) =
            client(request, stream).map_err(|e| WSClientError::Handshake(e.to_string()))?;
        Ok(Self { socket })
    }

    /// Receive a message from the websocket.
    ///
    /// It returns the message as a string.
    pub fn receive_raw(&mut self) -> Result<String, WSClientError> {
        let msg = self.socket.read()?;
        Ok(msg.to_string())
    }

    /// Receive an event from the websocket.
    ///
    /// It returns the message as an event.
    pub fn receive(&mut self) -> Result<Event, WSClientError> {
        let msg = self.receive_raw()?;
        let event: Event = serde_json::from_str(&msg)?;
        Ok(event)
    }

    fn find_port(url: &Url) -> u16 {
        url.port().unwrap_or_else(|| match url.scheme() {
            "wss" => 443,
            _ => 80,
        })
    }
}
