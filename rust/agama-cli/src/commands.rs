use crate::config::ConfigCommands;
use crate::profile::ProfileCommands;
use crate::questions::QuestionsCommands;
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Change or show installation settings
    #[command(subcommand)]
    Config(ConfigCommands),

    /// Display information about installation settings (e.g., possible values)
    Info {
        /// Configuration keys (e.g., software.products)
        keys: Vec<String>,
    },
    /// Start probing
    Probe,
    // Start Installation
    Install,
    /// Autoinstallation profile handling
    #[command(subcommand)]
    Profile(ProfileCommands),
    /// Configuration for questions that come from installer
    /// 
    /// Questions are raised when unexpected situation happen in Installer
    /// like if encrypted partition is detected and cannot be inspected,
    /// if repository is sign by unknown GPG key or if installer is not sure
    /// if multipath should be activated.
    /// 
    /// For more details see official agama documentation for Questions.
    #[command(subcommand)]
    Questions(QuestionsCommands),
}
