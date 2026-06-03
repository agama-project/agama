// NOTE: This file is generated. Run `cargo xtask cli-strings` to update it.
fn dummy_cli_strings() {
    // TRANSLATORS: command: agama
    gettext_noop!("Agama's command-line interface");
    // TRANSLATORS: command: agama (details)
    gettext_noop!("This program allows inspecting or changing Agama's configuration, handling installation profiles, starting the installation, monitoring the process, etc.\n\nPlease, use the \"help\" command to learn more.");
    // TRANSLATORS: command: agama --host <HOST>
    gettext_noop!("URI pointing to Agama's remote host");
    // TRANSLATORS: command: agama --host <HOST> (details)
    gettext_noop!("Examples: https://my-server.lan my-server.local localhost:10443");
    // TRANSLATORS: command: agama --insecure
    gettext_noop!("Whether to accept invalid (self-signed, ...) certificates or not");
    // TRANSLATORS: command: agama --local
    gettext_noop!("Some commands could be able to work even without connection to the agama server");
    // TRANSLATORS: command: agama config
    gettext_noop!("Inspect or change the installation settings");
    // TRANSLATORS: command: agama config (details)
    gettext_noop!("You can inspect and change installation settings from the command-line. The \"show\" subcommand generates a \"profile\" which is a JSON document describing the current configuration.\n\nIf you want to change any configuration value, you can load a profile (complete or partial) using the \"load\" subcommand.");
    // TRANSLATORS: command: agama config show
    gettext_noop!("Generate an installation profile with the current settings");
    // TRANSLATORS: command: agama config show (details)
    gettext_noop!("It is possible that many configuration settings do not have a value. Those settings are not included in the output.\n\nThe output of command can be used as input for the \"agama config load\".");
    // TRANSLATORS: command: agama config show --output <FILE_PATH>
    gettext_noop!("Save the output here (goes to stdout if not given)");
    // TRANSLATORS: command: agama config load
    gettext_noop!("Read and load a profile");
    // TRANSLATORS: command: agama config load <URL_OR_PATH>
    gettext_noop!("JSON file: URL or path or `-` for standard input");
    // TRANSLATORS: command: agama config validate
    gettext_noop!("Validate a profile using JSON Schema");
    // TRANSLATORS: command: agama config validate (details)
    gettext_noop!("Schema is available at /usr/share/agama/schema/profile.schema.json Note: validation is always done as part of all other \"agama config\" commands.");
    // TRANSLATORS: command: agama config validate <URL_OR_PATH>
    gettext_noop!("JSON file, URL or path or `-` for standard input");
    // TRANSLATORS: command: agama config validate --local
    gettext_noop!("Run subcommands (if possible) in local mode - without trying to connect to remote agama server");
    // TRANSLATORS: command: agama config generate
    gettext_noop!("Generate and print a native Agama JSON configuration from any kind and location.");
    // TRANSLATORS: command: agama config generate (details)
    gettext_noop!("Kinds:\n- JSON\n- Jsonnet, injecting the hardware information\n- AutoYaST profile, including ERB and rules/classes\n\nLocations:\n- path\n- URL (including AutoYaST specific schemes)\n\nFor an example of Jsonnet-based profile, see\nhttps://github.com/openSUSE/agama/blob/master/rust/agama-lib/share/examples/profile.jsonnet");
    // TRANSLATORS: command: agama config generate <URL_OR_PATH>
    gettext_noop!("JSON file: URL or path or `-` for standard input");
    // TRANSLATORS: command: agama config edit
    gettext_noop!("Edit and update installation option using an external editor");
    // TRANSLATORS: command: agama config edit (details)
    gettext_noop!("The changes are not applied if the editor exits with an error code.\n\nIf an editor is not specified, it honors the EDITOR environment variable. It falls back to `/usr/bin/vi` as a last resort.");
    // TRANSLATORS: command: agama config edit --editor <EDITOR>
    gettext_noop!("Editor command (including additional arguments if needed)");
    // TRANSLATORS: command: agama probe
    gettext_noop!("Analyze the system");
    // TRANSLATORS: command: agama probe (details)
    gettext_noop!("In Agama's jargon, the term 'probing' refers to the process of 'analyzing' the system. This includes reading software repositories, analyzing storage devices, and more. The 'probe' command initiates this analysis process and returns immediately. TODO: do we really need a \"probe\" action?");
    // TRANSLATORS: command: agama install
    gettext_noop!("Start the system installation");
    // TRANSLATORS: command: agama install (details)
    gettext_noop!("This command starts the installation process.  Beware it is a destructive operation because it will set up the storage devices, install the packages, etc.\n\nWhen the preconditions for the installation are not met, it informs the user and returns, making no changes to the system.");
    // TRANSLATORS: command: agama questions
    gettext_noop!("Handle installer questions");
    // TRANSLATORS: command: agama questions (details)
    gettext_noop!("Agama might require user intervention at any time. The reasons include providing some missing information (e.g., the password to decrypt a file system) or deciding what to do in case of an error (e.g., cannot connect to the repository).\n\nThis command allows answering such questions directly from the command-line.");
    // TRANSLATORS: command: agama questions mode
    gettext_noop!("Set the mode for answering questions");
    // TRANSLATORS: command: agama questions answers
    gettext_noop!("Load predefined answers");
    // TRANSLATORS: command: agama questions answers (details)
    gettext_noop!("It allows predefining answers for specific questions in order to skip them in interactive mode or change the answer in automatic mode.\n\nPlease check Agama documentation for more details and examples: https://github.com/openSUSE/agama/blob/master/doc/questions.");
    // TRANSLATORS: command: agama questions answers <PATH>
    gettext_noop!("Path to a file containing the answers in JSON format");
    // TRANSLATORS: command: agama questions list
    gettext_noop!("Prints the list of questions that are waiting for an answer in JSON format");
    // TRANSLATORS: command: agama questions ask
    gettext_noop!("Reads a question definition in JSON from stdin and prints the response when it is answered");
    // TRANSLATORS: command: agama logs
    gettext_noop!("Collect the installer logs");
    // TRANSLATORS: command: agama logs (details)
    gettext_noop!("The installer logs are stored in a compressed archive for further inspection. The file includes system and Agama-specific logs and configuration files. They are crucial to troubleshoot and debug problems.");
    // TRANSLATORS: command: agama logs store
    gettext_noop!("Collect and store the logs in a tar archive");
    // TRANSLATORS: command: agama logs store --destination <DESTINATION>
    gettext_noop!("Path to destination directory and, optionally, the archive file name. The extension will be added automatically");
    // TRANSLATORS: command: agama logs list
    gettext_noop!("List the logs to collect");
    // TRANSLATORS: command: agama auth
    gettext_noop!("Authenticate with Agama's server");
    // TRANSLATORS: command: agama auth (details)
    gettext_noop!("Unless you are executing this program as root, you need to authenticate with Agama's server for most operations. You can log in by specifying the root password through the \"auth login\" command. Upon successful authentication, the server returns a JSON Web Token (JWT) which is stored to authenticate the following requests.\n\nIf you run this program as root, you can skip the authentication step because it automatically uses the master token at /run/agama/token. Only the root user must have access to such a file.\n\nYou can logout at any time by using the \"auth logout\" command, although this command does not affect the root user.");
    // TRANSLATORS: command: agama auth login
    gettext_noop!("Authenticate with Agama's server and store the token");
    // TRANSLATORS: command: agama auth login (details)
    gettext_noop!("This command tries to get the password from the standard input. If it is not there, it asks the user interactively. Upon successful login, it stores the token in .agama/agama-jwt. The token will be automatically sent to authenticate the following requests.");
    // TRANSLATORS: command: agama auth logout
    gettext_noop!("Deauthenticate by removing the token");
    // TRANSLATORS: command: agama auth show
    gettext_noop!("Print the used token to the standard output");
    // TRANSLATORS: command: agama download
    gettext_noop!("Download file from a given (AutoYaST) URL");
    // TRANSLATORS: command: agama download (details)
    gettext_noop!("The purpose of this command is to download files using AutoYaST supported schemas (e.g. device://). It can be used to download additional scripts, configuration files and so on. You can use it for downloading Agama autoinstallation profiles. If you want to convert an AutoYaST profile, use \"agama config generate\".");
    // TRANSLATORS: command: agama download <URL>
    gettext_noop!("URL reference pointing to file for download. If a relative URL is provided, it will be resolved against the current working directory");
    // TRANSLATORS: command: agama download <DESTINATION>
    gettext_noop!("File name");
    // TRANSLATORS: command: agama finish
    gettext_noop!("Finish the installation");
    // TRANSLATORS: command: agama finish <METHOD>
    gettext_noop!("What to do after finishing the installation. Possible values:");
    // TRANSLATORS: command: agama finish <METHOD> (details)
    gettext_noop!("stop - do not reboot and the Agama backend continues running.\n\nreboot - reboot into the installed system. This value is the default. It can be overriden by setting the inst.finish kernel command-line argument.\n\nhalt - halt the installed machine.\n\npoweroff - power off the installed machine.");
    // TRANSLATORS: command: agama monitor
    gettext_noop!("Continuously monitors the Agama service until it finishes");
    // TRANSLATORS: command: agama status
    gettext_noop!("Prints the current state of the installation (e.g., waiting, blocked, running, or finished)");
    // TRANSLATORS: command: agama status --format <FORMAT>
    gettext_noop!("Specify in which format status will be shown");
    // TRANSLATORS: command: agama events
    gettext_noop!("Display Agama events");
    // TRANSLATORS: command: agama events --pretty
    gettext_noop!("Display the events in a more human-readable way");
}
