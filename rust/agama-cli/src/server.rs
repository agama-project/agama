use clap::Subcommand;
use reqwest::header::{HeaderMap, CONTENT_TYPE, HeaderValue};
use std::io;
use std::io::{BufRead, BufReader};
use std::fs::File;
use std::path::{PathBuf};

const DEFAULT_JWT_FILE: &str = "/tmp/agama-jwt";

#[derive(Subcommand, Debug)]
pub enum ServerCommands {
    /// Login with defined server. Result is JWT stored and used in all subsequent commands
    Login {
      #[clap(long, short = 'p')]
      password: Option<String>,
      #[clap(long, short = 'f')]
      file: Option<PathBuf>,
    },
    /// Release currently stored JWT
    Logout,
}

/// Main entry point called from agama CLI main loop
pub async fn run(subcommand: ServerCommands) -> anyhow::Result<()> {
    match subcommand {
        ServerCommands::Login {
            password,
            file,
        }=> {
            // actions to do:
            // 1) somehow obtain credentials (interactive, commandline, from a file)
            // credentials are handled in this way (in descending priority)
            // "command line options" -> "read from file" -> "ask to the user"
            // 2) pass credentials to the web server
            // 3) receive JWT
            // 4) store the JWT in a well known location

            let options = LoginOptions {
                password: password,
                file: file,
            };

            login(LoginOptions::parse(options).password()?).await
        },
        ServerCommands::Logout => {
            // actions to do:
            // 1) release JWT from the well known location if any
            logout()
        },
    }
}

/// Stores user provided configuration for login command
struct LoginOptions {
    password: Option<String>,
    file: Option<PathBuf>,
}

impl LoginOptions {
    /// Transforms user provided options into internal representation
    /// See Credentials trait
    fn parse(options: LoginOptions) -> Box<dyn Credentials> {
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
                "Cannot find the file with credentials.",
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
        println!("Enter credentials needed for accessing installation server");

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

/// Necessary http request header for authenticate
fn authenticate_headers() -> HeaderMap {
    let mut headers = HeaderMap::new();

    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

    headers
}

async fn get_jwt(password: String) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:3000/authenticate")
        .headers(authenticate_headers())
        .body(format!("{{\"password\": \"{}\"}}", password))
        .send()
        .await?;
    let body = response.json::<std::collections::HashMap<String, String>>()
        .await?;
    let value = body.get(&"token".to_string());

    if let Some(token) = value {
        return Ok(token.clone())
    }

    Err(anyhow::anyhow!("Failed to get JWT token"))
}

/// Logs into the installation web server and stores JWT for later use.
async fn login(password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    let res = get_jwt(password).await?;

    // 2) if successful store the JWT for later use
    std::fs::write(DEFAULT_JWT_FILE, res)?;

    Ok(())
}

/// Releases JWT
fn logout() -> anyhow::Result<()> {
    std::fs::remove_file(DEFAULT_JWT_FILE)?;

    Ok(())
}
