use crate::auth::AuthCommands;
use crate::config::ConfigCommands;
use crate::logs::LogsCommands;
use crate::profile::ProfileCommands;
use crate::questions::QuestionsCommands;
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Change or show installation settings
    #[command(subcommand)]
    Config(ConfigCommands),

    Probe,
    // Start Installation
    Install,
    /// Autoinstallation profile handling
    #[command(subcommand)]
    Profile(ProfileCommands),
    /// Configuration for questions that come from installer
    ///
    /// Questions are raised when an unexpected (by the user) situation happens in the installer:
    /// like if an encrypted partition is detected and cannot be inspected,
    /// if a repository is signed by an unknown GPG key, or if the installer is not sure
    /// if multipath should be activated.
    ///
    /// For more details see official agama documentation for Questions.
    #[command(subcommand)]
    Questions(QuestionsCommands),
    /// Collects logs
    #[command(subcommand)]
    Logs(LogsCommands),
    /// Request an action on the web server like Login / Logout
    #[command(subcommand)]
    Auth(AuthCommands),
}
