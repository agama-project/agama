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
pub async fn run(_subcommand: ServerCommands) -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}
