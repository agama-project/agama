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
use agama_utils::make_long;
use clap::{ArgMatches, Command};
use url::Url;

use crate::auth_tokens_file::AuthTokensFile;
use crate::error::CliError;
use agama_lib::http::BaseHTTPClient;
use gettextrs::gettext;
use i18n_format::i18n_format;
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
    pub async fn authenticate(&self, password: String) -> anyhow::Result<String> {
        let mut auth_body = HashMap::new();

        auth_body.insert("password", password);

        let response = self
            .api
            .post::<HashMap<String, String>>("/auth", &auth_body)
            .await?;

        match response.get("token") {
            Some(token) => Ok(token.clone()),
            None => Err(anyhow::anyhow!("Failed to get authentication token")),
        }
    }
}

pub fn build_auth_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama auth
    let about = gettext("Authenticate with Agama's server");
    // TRANSLATORS: CLI help for: agama auth (details)
    let long_about = make_long(&about, &gettext("\
        Unless you are executing this program as root, you need to authenticate with Agama's server \
        for most operations. You can log in by specifying the root password through the \"auth login\" \
        command. Upon successful authentication, the server returns a JSON Web Token (JWT) which is \
        stored to authenticate the following requests.\n\
        \n\
        If you run this program locally as root, you can skip the authentication step because it \
        automatically uses the master token at /run/agama/token. Only the root user must have access \
        to such a file.\n\
        \n\
        You can logout at any time by using the \"auth logout\" command, although this command does \
        not affect the root user."));
    Command::new("auth")
        .subcommand_required(true)
        .arg_required_else_help(true)
        .about(&about)
        .long_about(long_about)
        .subcommand(build_auth_login_cmd())
        .subcommand(
            Command::new("logout")
                // TRANSLATORS: CLI help for: agama auth logout
                .about(gettext("Deauthenticate by removing the token")),
        )
        .subcommand(
            Command::new("show")
                // TRANSLATORS: CLI help for: agama auth show
                .about(gettext("Print the used token to the standard output")),
        )
}

fn build_auth_login_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama auth login
    let about = gettext("Authenticate with Agama's server and store the token");
    // TRANSLATORS: CLI help for: agama auth login (details)
    let long_about = make_long(&about, &gettext("\
        This command tries to get the password from the standard input. If it is not there, it asks \
        the user interactively. Upon successful login, it stores the token in .agama/agama-jwt. The \
        token will be automatically sent to authenticate the following requests."));
    Command::new("login").about(&about).long_about(long_about)
}

/// Main entry point called from agama CLI main loop
pub async fn run(client: BaseHTTPClient, sub_matches: &ArgMatches) -> anyhow::Result<()> {
    let auth_client = AuthHTTPClient::load(client)?;

    match sub_matches.subcommand() {
        Some(("login", _)) => login(auth_client, read_password()?).await,
        Some(("logout", _)) => logout(auth_client),
        Some(("show", _)) => show(&auth_client.api.base_url),
        _ => Ok(()),
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
    Password::new(&gettext("Please enter the root password:"))
        .without_confirmation()
        .prompt()
        .map_err(CliError::InteractivePassword)
}

/// Logs into the installation web server and stores JWT for later use.
async fn login(client: AuthHTTPClient, password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    let res = client.authenticate(password).await?;
    let token = AuthToken::new(&res);
    let mut hosts_config = AuthTokensFile::read().unwrap_or_default();
    let hostname = client.api.base_url.host_str().unwrap_or("localhost");
    hosts_config.update_token(hostname, &token);
    Ok(hosts_config.write()?)
}

/// Releases JWT
fn logout(client: AuthHTTPClient) -> anyhow::Result<()> {
    let hostname = client.api.base_url.host_str().unwrap_or("localhost");
    if let Ok(mut file) = AuthTokensFile::read() {
        file.remove_host(hostname);
        file.write()?;
    }
    Ok(())
}

/// Shows stored JWT on stdout
fn show(url: &Url) -> anyhow::Result<()> {
    let hostname = url.host_str().unwrap_or("localhost");
    if let Ok(file) = AuthTokensFile::read() {
        if let Some(token) = file.get_token(hostname) {
            println!("{}", token.as_str());
            return Ok(());
        }
    }

    // TRANSLATORS: {0} is a host name
    println!("{}", i18n_format!("Not authenticated in {0}", hostname));
    Ok(())
}
