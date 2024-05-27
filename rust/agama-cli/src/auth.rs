use clap::Subcommand;

use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use std::fs;
use std::fs::File;
use std::io::{self, IsTerminal};
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use crate::error::CliError;

const DEFAULT_JWT_FILE: &str = ".agama/agama-jwt";
const DEFAULT_AGAMA_TOKEN_FILE: &str = "/run/agama/token";
const DEFAULT_AUTH_URL: &str = "http://localhost/api/auth";
const DEFAULT_FILE_MODE: u32 = 0o600;

#[derive(Subcommand, Debug)]
pub enum AuthCommands {
    /// Authenticate with Agama's server and store the credentials
    ///
    /// It reads the password from the standard input. If it is not available,
    /// it asks the user.
    Login,
    /// Deauthenticate by removing the credentials
    Logout,
    /// Prints currently stored credentials to the standard output
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

/// Returns the stored Agama token.
pub fn agama_token() -> anyhow::Result<String> {
    if let Some(file) = agama_token_file() {
        if let Ok(token) = read_line_from_file(file.as_path()) {
            return Ok(token);
        }
    }

    Err(anyhow::anyhow!("Authentication token not available"))
}

/// Reads stored token and returns it
pub fn jwt() -> anyhow::Result<String> {
    if let Some(file) = jwt_file() {
        if let Ok(token) = read_line_from_file(file.as_path()) {
            return Ok(token);
        }
    }

    Err(anyhow::anyhow!("Authentication token not available"))
}

/// Reads the password
///
/// It reads the password from stdin if available; otherwise, it asks the
/// user.
fn read_password() -> Result<String, CliError> {
    let stdin = io::stdin();
    let password = if stdin.is_terminal() {
        rpassword::prompt_password("Please, introduce the root password: ")?
    } else {
        let mut buffer = String::new();
        stdin.read_line(&mut buffer)?;
        buffer
    };
    Ok(password)
}

/// Path to file where JWT is stored
fn jwt_file() -> Option<PathBuf> {
    Some(home::home_dir()?.join(DEFAULT_JWT_FILE))
}
/// Path to agama-live token file.
fn agama_token_file() -> Option<PathBuf> {
    home::home_dir().map(|p| p.join(DEFAULT_AGAMA_TOKEN_FILE))
}

/// Reads first line from given file
fn read_line_from_file(path: &Path) -> io::Result<String> {
    if !path.exists() {
        return Err(io::Error::new(
            io::ErrorKind::Other,
            "Cannot find the file containing the credentials.",
        ));
    }

    if let Ok(file) = File::open(path) {
        // cares only of first line, take everything. No comments
        // or something like that supported
        let raw = BufReader::new(file).lines().next();

        if let Some(line) = raw {
            return line;
        }
    }

    Err(io::Error::new(
        io::ErrorKind::Other,
        "Failed to open the file",
    ))
}

/// Sets the archive owner to root:root. Also sets the file permissions to read/write for the
/// owner only.
fn set_file_permissions(file: &Path) -> io::Result<()> {
    let attr = fs::metadata(file)?;
    let mut permissions = attr.permissions();

    // set the file file permissions to -rw-------
    permissions.set_mode(DEFAULT_FILE_MODE);
    fs::set_permissions(file, permissions)?;

    Ok(())
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

    // 2) if successful store the JWT for later use
    if let Some(path) = jwt_file() {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        } else {
            return Err(anyhow::anyhow!("Cannot store the authentication token"));
        }

        fs::write(path.as_path(), res)?;
        set_file_permissions(path.as_path())?;
    }

    Ok(())
}

/// Releases JWT
fn logout() -> anyhow::Result<()> {
    let path = jwt_file();

    if !&path.clone().is_some_and(|p| p.exists()) {
        // mask if the file with the JWT doesn't exist (most probably no login before logout)
        return Ok(());
    }

    // panicking is right thing to do if expect fails, becase it was already checked twice that
    // the path exists
    let file = path.expect("Cannot locate stored JWT");

    Ok(fs::remove_file(file)?)
}

/// Shows stored JWT on stdout
fn show() -> anyhow::Result<()> {
    // we do not care if jwt() fails or not. If there is something to print, show it otherwise
    // stay silent
    if let Ok(token) = jwt() {
        println!("{}", token);
    }

    Ok(())
}
