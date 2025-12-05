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

//! This module includes some utility functions borrowed from the current CLI.
//! They should find a better place but it is out of the scope of the project right now.

use agama_cli::AuthTokensFile;
use agama_lib::{
    auth::AuthToken,
    http::{BaseHTTPClient, WebSocketClient},
};
use anyhow::anyhow;
use ratatui::layout::{Constraint, Flex, Layout, Rect};
use url::Url;

/// * `api_url`: API URL.
/// * `insecure`: whether an insecure connnection (e.g., using a self-signed certificate)
///   is allowed.
/// * `authenticated`: build an authenticated client (if possible).
pub async fn build_http_client(
    api_url: Url,
    insecure: bool,
    authenticated: bool,
) -> anyhow::Result<BaseHTTPClient> {
    let mut client = BaseHTTPClient::new(api_url)?;

    if insecure {
        client = client.insecure();
    }

    // we need to distinguish commands on those which assume that authentication JWT is already
    // available and those which not (or don't need it)
    if authenticated {
        // this deals with authentication need inside
        if let Some(token) = find_client_token(&client.base_url) {
            return Ok(client.authenticated(&token)?);
        }
        return Err(anyhow!(
            "You must authenticate using the \"agama auth login\" command!"
        ));
    } else {
        Ok(client.unauthenticated()?)
    }
}

/// Build a WebSocket client.
///
/// * `api_url`: API URL.
/// * `insecure`: whether an insecure connnection (e.g., using a self-signed certificate)
///   is allowed.
pub async fn build_ws_client(api_url: Url, insecure: bool) -> anyhow::Result<WebSocketClient> {
    let mut url = api_url.join("ws")?;
    let scheme = if api_url.scheme() == "http" {
        "ws"
    } else {
        "wss"
    };

    let token = find_client_token(&api_url).ok_or(anyhow!(
        "You must authenticate using the \"agama auth login\" command"
    ))?;

    // Setting the scheme to a known value ("ws" or "wss" should not fail).
    url.set_scheme(scheme).unwrap();
    Ok(WebSocketClient::connect(&url, &token, insecure).await?)
}

fn find_client_token(api_url: &Url) -> Option<AuthToken> {
    let hostname = api_url.host_str().unwrap_or("localhost");
    if let Ok(hosts_file) = AuthTokensFile::read() {
        if let Some(token) = hosts_file.get_token(hostname) {
            return Some(token);
        }
    }

    AuthToken::master()
}

/// Create a centered rect using up certain percentage of the available rect
///
/// Borrowed from Ratatui examples: https://github.com/ratatui/ratatui/blob/main/examples/apps/popup/src/main.rs#L63.
/// helper function to create a centered rect using up certain percentage of the available rect `r`
pub fn popup_area(area: Rect, percent_x: u16, percent_y: u16) -> Rect {
    use Constraint::Percentage;
    use Flex::Center;

    let vertical = Layout::vertical([Percentage(percent_y)]).flex(Center);
    let horizontal = Layout::horizontal([Percentage(percent_x)]).flex(Center);
    let [area] = vertical.areas(area);
    let [area] = horizontal.areas(area);
    area
}
