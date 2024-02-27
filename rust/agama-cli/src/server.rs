use clap::Subcommand;

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

/// Main entry point called from agama CLI main loop
pub async fn run(subcommand: ServerCommands) -> anyhow::Result<()> {
    match subcommand {
        ServerCommands::Login {
            user,
            password,
        }=> {
            // actions to do:
            // 1) somehow obtain credentials (interactive, commandline, from a file)
            // 2) pass credentials to the web server
            // 3) receive JWT
            // 4) store the JWT in a well known location
            login(user.unwrap_or(String::new()), password.unwrap_or(String::new()))
        },
        ServerCommands::Logout => {
            // actions to do:
            // 1) release JWT from the well known location if any
            logout()
        },
    }
}

/// Asks user to enter user name / password or read it from a file
fn get_credentials() {
}

fn login(user: String, password: String) -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}

fn logout() -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}
