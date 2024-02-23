use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum ServerCommands {
}

/// Main entry point called from agama CLI main loop
pub async fn run(_subcommand: ServerCommands) -> anyhow::Result<()> {
    Err(anyhow::anyhow!("Not implemented"))
}
