use clap::{arg, Args, Subcommand};
use reqwest::header::{HeaderMap, HeaderValue, CONTENT_TYPE};
use std::fs;
use std::fs::File;
use std::io;
use std::io::{BufRead, BufReader};
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

const DEFAULT_JWT_FILE: &str = "/tmp/agama-jwt";
const DEFAULT_AUTH_URL: &str = "http://localhost:3000/authenticate";
const DEFAULT_FILE_MODE: u32 = 0o600;

#[derive(Subcommand, Debug)]
pub enum AuthCommands {
    /// Login with defined server. Result is JWT stored locally and made available to
    /// further use. Password can be provided by commandline option, from a file or it fallbacks
    /// into an interactive prompt.
    Login(LoginArgs),
    /// Release currently stored JWT
    Logout,
}

/// Main entry point called from agama CLI main loop
pub async fn run(subcommand: AuthCommands) -> anyhow::Result<()> {
    match subcommand {
        AuthCommands::Login(options) => login(LoginArgs::proceed(options).password()?).await,
        AuthCommands::Logout => logout(),
    }
}

/// Stores user provided configuration for login command
#[derive(Args, Debug)]
pub struct LoginArgs {
    #[arg(long, short = 'p')]
    password: Option<String>,
    #[arg(long, short = 'f')]
    file: Option<PathBuf>,
}

impl LoginArgs {
    /// Transforms user provided options into internal representation
    /// See Credentials trait
    fn proceed(options: LoginArgs) -> Box<dyn Credentials> {
        match options.password {
            // explicitly provided user + password
            Some(p) => Box::new(KnownCredentials { password: p }),
            _ => match options.file {
                // try to read user + password from a file
                Some(f) => Box::new(FileCredentials { path: f }),
                // last instance - ask user to enter user + password interactively
                _ => Box::new(MissingCredentials {}),
            },
        }
    }
}

/// Placeholder for no configuration provided by user
struct MissingCredentials;

/// Stores whatever is needed for reading credentials from a file
struct FileCredentials {
    path: PathBuf,
}

/// Stores credentials as provided by the user directly
struct KnownCredentials {
    password: String,
}

/// Transforms credentials from user's input into format used internaly
trait Credentials {
    fn password(&self) -> io::Result<String>;
}

impl Credentials for KnownCredentials {
    fn password(&self) -> io::Result<String> {
        Ok(self.password.clone())
    }
}

impl Credentials for FileCredentials {
    fn password(&self) -> io::Result<String> {
        if !&self.path.as_path().exists() {
            return Err(io::Error::new(
                io::ErrorKind::Other,
                "Cannot find the file containing the credentials.",
            ));
        }

        if let Ok(file) = File::open(&self.path) {
            // cares only of first line, take everything. No comments
            // or something like that supported
            let line = BufReader::new(file).lines().next();

            if let Some(password) = line {
                return Ok(password?);
            }
        }

        Err(io::Error::new(
            io::ErrorKind::Other,
            "Failed to open the file",
        ))
    }
}

impl Credentials for MissingCredentials {
    fn password(&self) -> io::Result<String> {
        let password = read_credential("Password".to_string())?;

        Ok(password)
    }
}

/// Asks user to provide a line of input. Displays a prompt.
fn read_credential(caption: String) -> io::Result<String> {
    let mut cred = String::new();

    println!("{}: ", caption);

    io::stdin().read_line(&mut cred)?;
    if cred.pop().is_none() || cred.is_empty() {
        return Err(io::Error::new(
            io::ErrorKind::Other,
            format!("Failed to read {}", caption),
        ));
    }

    Ok(cred)
}

/// Sets the archive owner to root:root. Also sets the file permissions to read/write for the
/// owner only.
fn set_file_permissions(file: &String) -> io::Result<()> {
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
    let value = body.get(&"token".to_string());

    if let Some(token) = value {
        return Ok(token.clone());
    }

    Err(anyhow::anyhow!("Failed to get JWT token"))
}

/// Logs into the installation web server and stores JWT for later use.
async fn login(password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    let res = get_jwt(DEFAULT_AUTH_URL.to_string(), password).await?;

    // 2) if successful store the JWT for later use
    std::fs::write(DEFAULT_JWT_FILE, res)?;
    set_file_permissions(&DEFAULT_JWT_FILE.to_string())?;

    Ok(())
}

/// Releases JWT
fn logout() -> anyhow::Result<()> {
    // mask if the file with the JWT doesn't exist (most probably no login before logout)
    if !Path::new(DEFAULT_JWT_FILE).exists() {
        return Ok(());
    }

    Ok(std::fs::remove_file(DEFAULT_JWT_FILE)?)
}
