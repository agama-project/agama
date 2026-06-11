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

use std::path::PathBuf;

use crate::FinishMethod;
use agama_utils::make_long;
use clap::{value_parser, Arg, ArgAction, Command, ValueEnum};
use gettextrs::gettext;

#[derive(ValueEnum, Debug, Clone)]
pub enum Format {
    /// json format suitable for machine processing
    Json,
    /// textual format that is optimized to be read for humans, can change in future and can be localized
    Text,
}

pub fn build_config_cmd() -> Command {
    crate::config::build_config_cmd()
}

pub fn build_probe_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama probe
    let about = gettext("Analyze the system");
    // TRANSLATORS: CLI help for: agama probe (details)
    let long_about = make_long(&about, &gettext("\
        In Agama's jargon, the term 'probing' refers to the process of 'analyzing' the system. This \
        includes reading software repositories, analyzing storage devices, and more. The 'probe' \
        command initiates this analysis process and returns immediately. \
        TODO: do we really need a \"probe\" action?"));
    Command::new("probe").about(&about).long_about(long_about)
}

pub fn build_install_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama install
    let about = gettext("Start the system installation");
    // TRANSLATORS: CLI help for: agama install (details)
    let long_about = make_long(&about, &gettext("\
        This command starts the installation process.  Beware it is a destructive operation because \
        it will set up the storage devices, install the packages, etc.\n\
        \n\
        When the preconditions for the installation are not met, it informs the user and returns, \
        making no changes to the system."));
    Command::new("install").about(&about).long_about(long_about)
}

pub fn build_questions_cmd() -> Command {
    crate::questions::build_questions_cmd()
}

pub fn build_logs_cmd() -> Command {
    crate::logs::build_logs_cmd()
}

pub fn build_auth_cmd() -> Command {
    crate::auth::build_auth_cmd()
}

pub fn build_download_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama download
    let about = gettext("Download file from a given (AutoYaST) URL");
    // TRANSLATORS: CLI help for: agama download (details)
    let long_about = make_long(&about, &gettext("\
        The purpose of this command is to download files using AutoYaST supported schemas (e.g. device://). \
        It can be used to download additional scripts, configuration files and so on. \
        You can use it for downloading Agama autoinstallation profiles. \
        If you want to convert an AutoYaST profile, use \"agama config generate\"."));
    Command::new("download")
        .about(&about)
        .long_about(long_about)
        .arg(
            Arg::new("url")
                .value_name("URL")
                .required(true)
                .help(gettext(
                    // TRANSLATORS: CLI help for: agama download <URL>
                    "URL reference pointing to file for download. If a relative URL is \
                              provided, it will be resolved against the current working directory",
                )),
        )
        .arg(
            Arg::new("destination")
                .value_name("DESTINATION")
                .required(true)
                .value_parser(value_parser!(PathBuf))
                // TRANSLATORS: CLI help for: agama download <DESTINATION>
                .help(gettext("File name")),
        )
}

pub fn build_finish_cmd() -> Command {
    Command::new("finish")
        // TRANSLATORS: CLI help for: agama finish
        .about(gettext("Finish the installation"))
        .arg(
            Arg::new("method")
                .value_name("METHOD")
                .value_parser(value_parser!(FinishMethod))
                // TRANSLATORS: CLI help for: agama finish <METHOD>
                .help(gettext("\
                    What to do after finishing the installation. Possible values:\n\
                               \n\
                               \x20  stop - do not reboot and the Agama backend continues running.\n\
                               \n\
                               \x20  reboot - reboot into the installed system. This value is the \
                                        default. It can be overriden by setting the inst.finish \
                                        kernel command-line argument.\n\
                               \n\
                               \x20  halt - halt the installed machine.\n\
                               \n\
                               \x20  poweroff - power off the installed machine.",
                )),
        )
}

pub fn build_monitor_cmd() -> Command {
    // TRANSLATORS: CLI help for: agama monitor
    let about = gettext("Continuously monitors the Agama service until it finishes");
    Command::new("monitor").about(about)
}

pub fn build_status_cmd() -> Command {
    Command::new("status")
        // TRANSLATORS: CLI help for: agama status
        .about(gettext("Prints the current state of the installation (e.g., waiting, blocked, running, or finished)"))
        .arg(
            Arg::new("format")
                .value_name("FORMAT")
                .long("format")
                .value_parser(value_parser!(Format))
                .default_value("text")
                // TRANSLATORS: CLI help for: agama status --format <FORMAT>
                .help(gettext("Specify in which format status will be shown"))
        )
}

pub fn build_events_cmd() -> Command {
    Command::new("events")
        // TRANSLATORS: CLI help for: agama events
        .about(gettext("Display Agama events"))
        .arg(
            Arg::new("pretty")
                .short('p')
                .long("pretty")
                .action(ArgAction::SetTrue)
                // TRANSLATORS: CLI help for: agama events --pretty
                .help(gettext("Display the events in a more human-readable way")),
        )
}
