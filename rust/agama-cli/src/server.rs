use clap::Subcommand;
use std::io;
use std::io::{BufRead, BufReader};
use std::fs::File;
use std::path::{PathBuf};

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

struct Credentials {
    password: String,
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

            // little bit tricky way of error conversion to deal with
            // errors reported for anyhow::Error when using '?'
            let credentials = get_credentials(password, file)
                .ok_or(Err(())).map_err(|_err: Result<(), ()>| anyhow::anyhow!("Wrong credentials"))?;

            login(credentials.password)
        },
        ServerCommands::Logout => {
            // actions to do:
            // 1) release JWT from the well known location if any
            logout()
        },
    }
}

/// Reads credentials from a given file (if exists)
fn get_credentials_from_file(path: PathBuf) -> Option<Credentials> {
    if !path.as_path().exists() {
        return None;
    }

    if let Ok(file) = File::open(path) {
        let line = BufReader::new(file).lines().next()?;

        if let Ok(password) = line {
            return Some(Credentials {
                password: password,
            })
        }
    }

    None
}

fn read_credential(caption: String) -> Option<String> {
    let mut cred = String::new();

    println!("{}: ", caption);

    if io::stdin().read_line(&mut cred).is_err() {
        return None;
    }
    if cred.pop().is_none() || cred.is_empty() {
        return None;
    }

    Some(cred)
}

/// Asks user to enter credentials interactively
fn get_credentials_from_user() -> Option<Credentials> {
    println!("Enter credentials needed for accessing installation server");

    let password = read_credential("Password".to_string())?;

    Some(Credentials {
        password: password,
    })
}

/// Handles various ways how to get user name / password from user or read it from a file
fn get_credentials(password: Option<String>, file: Option<PathBuf>) -> Option<Credentials> {
    match password {
        // explicitly provided user + password
        Some(p) => Some(Credentials {
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

fn login(password: String) -> anyhow::Result<()> {
    // 1) ask web server for JWT
    // 2) if successful store the JWT for later use
    println!("Loging with credentials:");
    println!("({})", password);

    Err(anyhow::anyhow!("Not implemented"))
}

fn logout() -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}
