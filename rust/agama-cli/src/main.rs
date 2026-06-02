// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use agama_cli::{run_command, Cli, CliResult};
use agama_l10n::helpers as l10n_helpers;
use clap::{CommandFactory, FromArgMatches};

fn translate_command(mut cmd: clap::Command) -> clap::Command {
    use gettextrs::gettext;

    if let Some(about) = cmd.get_about().map(|a| a.to_string()) {
        cmd = cmd.about(gettext(&about));
    }
    if let Some(long_about) = cmd.get_long_about().map(|a| a.to_string()) {
        cmd = cmd.long_about(gettext(long_about));
    }

    let mut args = Vec::new();
    for arg in cmd.get_arguments() {
        let mut new_arg = arg.clone();
        if let Some(help) = new_arg.get_help().map(|h| h.to_string()) {
            new_arg = new_arg.help(gettext(help));
        }
        if let Some(long_help) = new_arg.get_long_help().map(|h| h.to_string()) {
            new_arg = new_arg.long_help(gettext(long_help));
        }
        args.push(new_arg);
    }

    for arg in args {
        let id = arg.get_id().clone();
        cmd = cmd.mut_arg(&id, |_| arg.clone());
    }

    let mut subcommands = Vec::new();
    for subcmd in cmd.get_subcommands() {
        subcommands.push(translate_command(subcmd.clone()));
    }

    for subcmd in subcommands {
        let name = subcmd.get_name().to_string();
        cmd = cmd.mut_subcommand(&name, |_| subcmd.clone());
    }

    cmd
}

#[tokio::main]
async fn main() -> CliResult {
    _ = l10n_helpers::init_locale();

    let mut cmd = Cli::command();
    cmd = translate_command(cmd);

    let matches = cmd.get_matches();
    let cli = Cli::from_arg_matches(&matches).unwrap_or_else(|err| err.exit());

    if let Err(error) = run_command(cli).await {
        eprintln!("{:?}", error);
        return CliResult::Error;
    }
    CliResult::Ok
}
