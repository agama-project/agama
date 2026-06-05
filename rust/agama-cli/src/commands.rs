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
use clap::{value_parser, Arg, ArgAction, Command, ValueEnum};
use gettextrs::gettext;

#[derive(ValueEnum, Debug, Clone)]
pub enum Format {
    Json,
    Text,
}

pub fn build_config_cmd() -> Command {
    crate::config::build_config_cmd()
}

pub fn build_probe_cmd() -> Command {
    Command::new("probe")
        .about(gettext("Analyze the system."))
        .long_about(gettext("In Agama's jargon, the term 'probing' refers to the process of 'analyzing' the system. This\n\
                             includes reading software repositories, analyzing storage devices, and more. The 'probe'\n\
                             command initiates this analysis process and returns immediately.\n\
                             \n\
                             TODO: do we really need a \"probe\" action?"))
}

pub fn build_install_cmd() -> Command {
    Command::new("install")
        .about(gettext("Start the system installation."))
        .long_about(gettext("This command starts the installation process.  Beware it is a destructive operation because\n\
                             it will set up the storage devices, install the packages, etc.\n\
                             \n\
                             When the preconditions for the installation are not met, it informs the user and returns,\n\
                             making no changes to the system."))
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
    Command::new("download")
        .about(gettext("Download file from a given (AutoYaST) URL"))
        .long_about(gettext("The purpose of this command is to download files using AutoYaST supported schemas (e.g. device://).\n\
                             It can be used to download additional scripts, configuration files and so on.\n\
                             You can use it for downloading Agama autoinstallation profiles.\n\
                             If you want to convert an AutoYaST profile, use \"agama config generate\"."))
        .arg(
            Arg::new("url")
                .required(true)
                .help(gettext("URL reference pointing to file for download. If a relative URL is\n\
                               provided, it will be resolved against the current working directory."))
        )
        .arg(
            Arg::new("destination")
                .required(true)
                .value_parser(value_parser!(PathBuf))
                .help(gettext("File name"))
        )
}

pub fn build_finish_cmd() -> Command {
    Command::new("finish")
        .about(gettext("Finish the installation."))
        .arg(
            Arg::new("method")
                .value_parser(value_parser!(FinishMethod))
                .help(gettext(
                    "What to do after finishing the installation. Possible values:\n\
                               \n\
                               stop - do not reboot and the Agama backend continues running.\n\
                               \n\
                               reboot - reboot into the installed system. This value is the\n\
                                        default. It can be overriden by setting the inst.finish\n\
                                        kernel command-line argument.\n\
                               \n\
                               halt - halt the installed machine.\n\
                               \n\
                               poweroff - power off the installed machine.",
                )),
        )
}

pub fn build_monitor_cmd() -> Command {
    Command::new("monitor").about(gettext(
        "Continuously monitors the Agama service until it finishes.",
    ))
}

pub fn build_status_cmd() -> Command {
    Command::new("status")
        .about(gettext("Prints the current state of the installation (e.g., waiting, blocked, running, or finished)."))
        .arg(
            Arg::new("format")
                .long("format")
                .value_parser(value_parser!(Format))
                .default_value("text")
                .help(gettext("Specify in which format status will be shown"))
        )
}

pub fn build_events_cmd() -> Command {
    Command::new("events")
        .about(gettext("Display Agama events."))
        .arg(
            Arg::new("pretty")
                .short('p')
                .long("pretty")
                .action(ArgAction::SetTrue)
                .help(gettext("Display the events in a more human-readable way.")),
        )
}
