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

fn translate_help_strings(
    short: Option<String>,
    long: Option<String>,
) -> (Option<String>, Option<String>) {
    use gettextrs::gettext;

    let trans_short = short.as_ref().map(gettext);

    let trans_long = if let Some(ref l) = long {
        if let Some(ref s) = short {
            if l.starts_with(s) && l != s {
                let suffix = &l[s.len()..];
                let trans_prefix = trans_short.clone().unwrap_or_else(|| gettext(s));
                let trans_suffix = gettext(suffix);
                Some(format!("{}{}", trans_prefix, trans_suffix))
            } else if l != s {
                Some(gettext(l))
            } else {
                trans_short.clone()
            }
        } else {
            Some(gettext(l))
        }
    } else {
        None
    };

    (trans_short, trans_long)
}

fn translate_command(mut cmd: clap::Command) -> clap::Command {
    let about = cmd.get_about().map(|a| a.to_string());
    let long_about = cmd.get_long_about().map(|a| a.to_string());

    let (trans_about, trans_long_about) = translate_help_strings(about, long_about);

    if let Some(tab) = trans_about {
        cmd = cmd.about(tab);
    }

    if let Some(tlab) = trans_long_about {
        cmd = cmd.long_about(tlab);
    }

    let mut args = Vec::new();
    for arg in cmd.get_arguments() {
        let mut new_arg = arg.clone();
        let help = new_arg.get_help().map(|h| h.to_string());
        let long_help = new_arg.get_long_help().map(|h| h.to_string());

        let (trans_help, trans_long_help) = translate_help_strings(help, long_help);

        if let Some(thp) = trans_help {
            new_arg = new_arg.help(thp);
        }

        if let Some(tlhp) = trans_long_help {
            new_arg = new_arg.long_help(tlhp);
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

#[cfg(test)]
mod tests {
    use super::*;
    use clap::{Arg, Command};

    #[test]
    fn test_translate_command_split_recombine() {
        let cmd = Command::new("test-cmd")
            .about("Short prefix")
            .long_about("Short prefix\n\nLong suffix description")
            .arg(
                Arg::new("test-arg")
                    .long("test")
                    .help("Short arg help")
                    .long_help("Short arg help\n\nLong arg suffix"),
            );

        let translated = translate_command(cmd);

        assert_eq!(translated.get_about().unwrap().to_string(), "Short prefix");
        assert_eq!(
            translated.get_long_about().unwrap().to_string(),
            "Short prefix\n\nLong suffix description"
        );

        let arg = translated
            .get_arguments()
            .find(|a| a.get_id() == "test-arg")
            .unwrap();

        assert_eq!(arg.get_help().unwrap().to_string(), "Short arg help");
        assert_eq!(
            arg.get_long_help().unwrap().to_string(),
            "Short arg help\n\nLong arg suffix"
        );
    }
}
