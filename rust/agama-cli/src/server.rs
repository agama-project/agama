use clap::Subcommand;
use std::path::{PathBuf};

#[derive(Subcommand, Debug)]
pub enum ServerCommands {
    /// Login with defined server. Result is JWT stored and used in all subsequent commands
    Login {
      #[clap(long, short = 'u')]
      user: Option<String>,
      #[clap(long, short = 'p')]
      password: Option<String>,
    },
    /// Release currently stored JWT
    Logout,
}

struct Credentials {
    user: String,
    password: String,
}

/// Main entry point called from agama CLI main loop
pub async fn run(subcommand: ServerCommands) -> anyhow::Result<()> {
    match subcommand {
        ServerCommands::Login {
            user,
            password,
        }=> {
            // actions to do:
            // 1) somehow obtain credentials (interactive, commandline, from a file)
            // credentials are handled in this way (in descending priority)
            // "command line options" -> "read from file" -> "ask to the user"
            // 2) pass credentials to the web server
            // 3) receive JWT
            // 4) store the JWT in a well known location

            // little bit tricky way of error conversion to deal with
            // errors reported for anyhow::Error when using '?'
            let credentials = get_credentials(user, password, None)
                .ok_or(Err(())).map_err(|_err: Result<(), ()>| anyhow::anyhow!("Missing credentials"))?;

            login(credentials.user, credentials.password)
        },
        ServerCommands::Logout => {
            // actions to do:
            // 1) release JWT from the well known location if any
            logout()
        },
    }
}

/// Reads credentials from a given file (if exists)
fn get_credentials_from_file(_file: PathBuf) -> Option<Credentials> {
    None
}

/// Asks user to enter credentials interactively
fn get_credentials_from_user() -> Option<Credentials> {
    None
}

/// Handles various ways how to get user name / password from user or read it from a file
fn get_credentials(user: Option<String>, password: Option<String>, file: Option<PathBuf>) -> Option<Credentials> {
    match (user, password) {
        // explicitly provided user + password
        (Some(u), Some(p)) => Some(Credentials {
                user: u,
                password: p,
            }),
        _ => match file {
            // try to read user + password from a file
            Some(f) => get_credentials_from_file(f),
            // last instance - ask user to enter user + password interactively
            _ => get_credentials_from_user(),
        },
    }
}

fn login(_user: String, _password: String) -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}

fn logout() -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}
