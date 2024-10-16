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

use agama_lib::{auth::AuthToken, error::ServiceError};
use clap::Subcommand;

use crate::error::CliError;
use agama_lib::base_http_client::BaseHTTPClient;
use inquire::Password;
use std::collections::HashMap;
use std::io::{self, IsTerminal};

/// HTTP client to handle authentication
struct AuthHTTPClient {
    api: BaseHTTPClient,
}

impl AuthHTTPClient {
    pub fn load(client: BaseHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self { api: client })
    }

    /// Query web server for JWT
    pub async fn receive_jwt(&self, password: String) -> anyhow::Result<String> {
        let mut auth_body = HashMap::new();

        auth_body.insert("password", password);

        let response = self
            .api
            .post::<HashMap<String, String>>("/auth", &auth_body)
            .await?;
        let value = response.get("token");

        if let Some(token) = value {
            return Ok(token.clone());
        }

        Err(
            anyhow::anyhow!("Authentication failed. Cannot get the authentication token."
        ))
    }
}

#[derive(Subcommand, Debug)]
pub enum AuthCommands {
    /// Authenticate with Agama's server and store the token.
    ///
    /// This command tries to get the password from the standard input. If it is not there, it asks
    /// the user interactively. Upon successful login, it stores the token in .agama/agama-jwt. The
    /// token will be automatically sent to authenticate the following requests.
    Login,
    /// Deauthenticate by removing the token.
    Logout,
    /// Print the used token to the standard output.
    Show,
}

/// Main entry point called from agama CLI main loop
pub async fn run(client: BaseHTTPClient, subcommand: AuthCommands) -> anyhow::Result<()> {
    let auth_client = AuthHTTPClient::load(client)?;

    match subcommand {
        AuthCommands::Login => login(auth_client, read_password()?).await,
        AuthCommands::Logout => logout(),
        AuthCommands::Show => show(),
    }
}

/// Reads the password
///
/// It reads the password from stdin if available; otherwise, it asks the
/// user.
fn read_password() -> Result<String, CliError> {
    let stdin = io::stdin();

    let password = if stdin.is_terminal() {
        ask_password()?
    } else {
        let mut buffer = String::new();
        stdin
            .read_line(&mut buffer)
            .map_err(CliError::StdinPassword)?;
        buffer
    };
    Ok(password)
}

/// Asks interactively for the password. (For authentication, not for changing it)
fn ask_password() -> Result<String, CliError> {
    Password::new("Please enter the root password:")
        .without_confirmation()
        .prompt()
        .map_err(CliError::InteractivePassword)
}

/// Logs into the installation web server and stores JWT for later use.
async fn login(client: AuthHTTPClient, password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    let res = client.receive_jwt(password).await?;
    let token = AuthToken::new(&res);
    Ok(token.write_user_token()?)
}

/// Releases JWT
fn logout() -> anyhow::Result<()> {
    Ok(AuthToken::remove_user_token()?)
}

/// Shows stored JWT on stdout
fn show() -> anyhow::Result<()> {
    // we do not care if jwt() fails or not. If there is something to print, show it otherwise
    // stay silent
    if let Some(token) = AuthToken::find() {
        println!("{}", token.as_str());
    }

    Ok(())
}
