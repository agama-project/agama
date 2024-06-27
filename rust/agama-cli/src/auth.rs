use agama_lib::auth::AuthToken;
use clap::Subcommand;

use crate::error::CliError;
use inquire::Password;
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use std::io::{self, IsTerminal};

const DEFAULT_AUTH_URL: &str = "http://localhost/api/auth";

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
pub async fn run(subcommand: AuthCommands) -> anyhow::Result<()> {
    match subcommand {
        AuthCommands::Login => login(read_password()?).await,
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

/// Necessary http request header for authenticate
fn authenticate_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();

    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    headers
}

/// Query web server for JWT
async fn get_jwt(url: String, password: String) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let response = client
        .post(url)
        .headers(authenticate_headers())
        .body(format!("{{\"password\": \"{}\"}}", password))
        .send()
        .await?;
    let body = response
        .json::<std::collections::HashMap<String, String>>()
        .await?;
    let value = body.get("token");

    if let Some(token) = value {
        return Ok(token.clone());
    }

    Err(anyhow::anyhow!("Failed to get authentication token"))
}

/// Logs into the installation web server and stores JWT for later use.
async fn login(password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    let res = get_jwt(DEFAULT_AUTH_URL.to_string(), password).await?;
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
