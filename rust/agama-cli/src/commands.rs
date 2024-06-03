use crate::auth::AuthCommands;
use crate::config::ConfigCommands;
use crate::logs::LogsCommands;
use crate::profile::ProfileCommands;
use crate::questions::QuestionsCommands;
use clap::Subcommand;

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Change or show the installation settings.
    ///
    /// You can set any Agama configuration value from the command-line. You can change individual
    /// values the "add" or "set" commands. Or modify many of them at a time by loading a so-called
    /// profile through the "load" command.
    ///
    /// Use "show" to display the current configuration in JSON format.
    #[command(subcommand)]
    Config(ConfigCommands),

    /// Analyze the system.
    ///
    /// In Agama's jargon, the term 'probing' refers to the process of 'analyzing' the system. This
    /// includes reading software repositories, analyzing storage devices, and more. The 'probe'
    /// command initiates this analysis process and returns immediately.

    /// TODO: do we really need a "probe" action?
    Probe,

    /// Start the system installation.
    ///
    /// This command starts the installation process.  Beware it is a destructive operation because
    /// it will set up the storage devices, install the packages, etc.
    ///
    /// When the preconditions for the installation are not met, it informs the user and returns,
    /// making no changes to the system.
    Install,

    /// Manage auto-installation profiles (retrieving, applying, etc.).
    #[command(subcommand)]
    Profile(ProfileCommands),

    /// Handle installer questions.
    ///
    /// Agama might require user intervention at any time. The reasons include providing some
    /// missing information (e.g., the password to decrypt a file system) or deciding what to do in
    /// case of an error (e.g., cannot connect to the repository).
    ///
    /// This command allows answering such questions directly from the command-line.
    #[command(subcommand)]
    Questions(QuestionsCommands),

    /// Collect the installer logs.
    ///
    /// The installer logs are stored in a compressed archive for further inspection. The file
    /// includes system and Agama-specific logs and configuration files. They are crucial to
    /// troubleshoot and debug problems.
    #[command(subcommand)]
    Logs(LogsCommands),

    /// Authenticate with Agama's server.
    ///
    /// Unless you are executing this program as root, you need to authenticate with Agama's server
    /// for most operations. You can log in by specifying the root password through the "auth login"
    /// command. Upon successful authentication, the server returns a JSON Web Token (JWT) which is
    /// stored to authenticate the following requests.
    ///
    /// If you run this program as root, you can skip the authentication step because it
    /// automatically uses the master token at /run/agama/token. Only the root user must have access
    /// to such a file.
    ///
    /// You can logout at any time by using the "auth logout" command, although this command does
    /// not affect the root user.
    #[command(subcommand)]
    Auth(AuthCommands),

    /// Download file from given URL
    ///
    /// The purpose of this command is to download files using AutoYaST supported schemas (e.g. device:// or relurl://).
    /// It can be used to download additional scripts, configuration files and so on.
    /// You can use it for downloading Agama autoinstallation profiles. However, unless you need additional processing,
    /// the "agama profile import" is recommended.
    /// If you want to convert an AutoYaST profile, use "agama profile autoyast".
    Download {
        /// URL pointing to file for download
        url: String,
    },
}
