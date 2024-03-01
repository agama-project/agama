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

            login(LoginOptions::parse(options).password()?)
        },
        ServerCommands::Logout => {
            // actions to do:
            // 1) release JWT from the well known location if any
            logout()
        },
    }
}

struct LoginOptions {
    password: Option<String>,
    file: Option<PathBuf>,
}

impl LoginOptions {
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

struct MissingCredentials;

struct FileCredentials {
    path: PathBuf,
}

struct KnownCredentials {
    password: String,
}

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
