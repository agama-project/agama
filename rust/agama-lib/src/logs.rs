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

use crate::error::ServiceError;
use fs_extra::copy_items;
use fs_extra::dir::CopyOptions;
use serde::Serialize;
use std::fs;
use std::fs::File;
use std::io;
use std::io::Write;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::TempDir;
use utoipa::ToSchema;

pub mod http_client;

const DEFAULT_COMMANDS: [(&str, &str); 3] = [
    // (<command to be executed>, <file name used for storing result of the command>)
    ("journalctl -u agama", "agama"),
    ("journalctl -u agama-auto", "agama-auto"),
    ("journalctl --dmesg", "dmesg"),
];

const DEFAULT_PATHS: [&str; 14] = [
    // logs
    "/var/log/YaST2",
    "/var/log/zypper.log",
    "/var/log/zypper/history*",
    "/var/log/zypper/pk_backend_zypp",
    "/var/log/pbl.log",
    "/var/log/linuxrc.log",
    "/var/log/wickedd.log",
    "/var/log/NetworkManager",
    "/var/log/messages",
    "/var/log/boot.msg",
    "/var/log/udev.log",
    // config
    "/etc/install.inf",
    "/etc/os-release",
    "/linuxrc.config",
];

const DEFAULT_RESULT: &str = "/tmp/agama-logs";
// what compression is used by default:
// (<compression as distinguished by tar>, <an extension for resulting archive>)
pub const DEFAULT_COMPRESSION: (&str, &str) = ("gzip", "tar.gz");
const TMP_DIR_PREFIX: &str = "agama-logs.";

/// Configurable parameters of the "agama logs" which can be
/// set by user when calling a (sub)command
pub struct LogOptions {
    paths: Vec<String>,
    commands: Vec<(String, String)>,
    destination: PathBuf,
}

impl Default for LogOptions {
    fn default() -> Self {
        Self {
            paths: DEFAULT_PATHS.iter().map(|p| p.to_string()).collect(),
            commands: DEFAULT_COMMANDS
                .iter()
                .map(|(cmd, name)| (cmd.to_string(), name.to_string()))
                .collect(),
            destination: PathBuf::from(DEFAULT_RESULT),
        }
    }
}

/// Struct for log represented by a file
struct LogPath {
    // log source
    src_path: String,

    // directory where to collect logs
    dst_path: PathBuf,
}

impl LogPath {
    fn new(src: &str, dst: &Path) -> Self {
        Self {
            src_path: src.to_string(),
            dst_path: dst.to_owned(),
        }
    }
}

/// Struct for log created on demand by a command
struct LogCmd {
    // command which stdout / stderr is logged
    cmd: String,

    // user defined log file name (if any)
    file_name: String,

    // place where to collect logs
    dst_path: PathBuf,
}

impl LogCmd {
    fn new(cmd: &str, file_name: &str, dst: &Path) -> Self {
        Self {
            cmd: cmd.to_string(),
            file_name: file_name.to_string(),
            dst_path: dst.to_owned(),
        }
    }
}

trait LogItem {
    // definition of destination as path to a file
    fn to(&self) -> PathBuf;

    // performs whatever is needed to store logs from "from" at "to" path
    fn store(&self) -> Result<(), io::Error>;
}

impl LogItem for LogPath {
    fn to(&self) -> PathBuf {
        // remove leading '/' if any from the path (reason see later)
        let r_path = Path::new(self.src_path.as_str()).strip_prefix("/").unwrap();

        // here is the reason, join overwrites the content if the joined path is absolute
        self.dst_path.join(r_path)
    }

    fn store(&self) -> Result<(), io::Error> {
        let dst_file = self.to();
        let dst_path = dst_file.parent().unwrap();

        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        fs::create_dir_all(dst_path)?;

        let options = CopyOptions::new();
        // fs_extra's own Error doesn't implement From trait so ? operator is unusable
        match copy_items(&[self.src_path.as_str()], dst_path, &options) {
            Ok(_p) => Ok(()),
            Err(_e) => Err(io::Error::new(
                io::ErrorKind::Other,
                "Copying of a file failed",
            )),
        }
    }
}

impl LogItem for LogCmd {
    fn to(&self) -> PathBuf {
        let mut file_name;

        if self.file_name.is_empty() {
            file_name = self.cmd.clone();
        } else {
            file_name = self.file_name.clone();
        };

        file_name.retain(|c| c != ' ');
        self.dst_path.as_path().join(&file_name)
    }

    fn store(&self) -> Result<(), io::Error> {
        let cmd_parts = self.cmd.split_whitespace().collect::<Vec<&str>>();
        let file_path = self.to();
        let output = Command::new(cmd_parts[0])
            .args(cmd_parts[1..].iter())
            .output()?;
        let mut file_stdout = File::create(format!("{}.out.log", file_path.display()))?;
        let mut file_stderr = File::create(format!("{}.err.log", file_path.display()))?;

        file_stdout.write_all(&output.stdout)?;
        file_stderr.write_all(&output.stderr)?;

        Ok(())
    }
}

/// Collect existing / requested paths which should already exist in the system.
/// Turns them into list of log sources
fn paths_to_log_sources(paths: &[String], tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for path in paths.iter() {
        // assumption: path is full path
        if Path::new(path).try_exists().is_ok() {
            log_sources.push(Box::new(LogPath::new(path.as_str(), tmp_dir.path())));
        }
    }

    log_sources
}

/// Some info can be collected via particular commands only, turn it into log sources
fn cmds_to_log_sources(commands: &[(String, String)], tmp_dir: &TempDir) -> Vec<Box<dyn LogItem>> {
    let mut log_sources: Vec<Box<dyn LogItem>> = Vec::new();

    for cmd in commands.iter() {
        log_sources.push(Box::new(LogCmd::new(
            cmd.0.as_str(),
            cmd.1.as_str(),
            tmp_dir.path(),
        )));
    }

    log_sources
}

/// Compress given directory into a tar archive
fn compress_logs(tmp_dir: &TempDir, result: &String) -> io::Result<()> {
    let compression = DEFAULT_COMPRESSION.0;
    let tmp_path = tmp_dir
        .path()
        .parent()
        .and_then(|p| p.as_os_str().to_str())
        .ok_or(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Malformed path to temporary directory",
        ))?;
    let dir = tmp_dir
        .path()
        .file_name()
        .and_then(|f| f.to_str())
        .ok_or(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Malformed path to temporary director",
        ))?;
    let compress_cmd = format!(
        "tar -c -f {} --warning=no-file-changed --{} --dereference -C {} {}",
        result, compression, tmp_path, dir,
    );
    let cmd_parts = compress_cmd.split_whitespace().collect::<Vec<&str>>();
    let res = Command::new(cmd_parts[0])
        .args(cmd_parts[1..].iter())
        .status()?;

    if res.success() {
        set_archive_permissions(PathBuf::from(result))
    } else {
        Err(io::Error::new(
            io::ErrorKind::Other,
            "Cannot create tar archive",
        ))
    }
}

/// Sets the archive owner to root:root. Also sets the file permissions to read/write for the
/// owner only.
pub fn set_archive_permissions(archive: PathBuf) -> io::Result<()> {
    let attr = fs::metadata(archive.as_path())?;
    let mut permissions = attr.permissions();

    // set the archive file permissions to -rw-------
    permissions.set_mode(0o600);
    fs::set_permissions(archive.clone(), permissions)?;

    // set the archive owner to root:root
    // note: std::os::unix::fs::chown is unstable for now
    std::os::unix::fs::chown(archive.as_path(), Some(0), Some(0))
}

/// Handler for the "agama logs store" subcommand
pub fn store(options: LogOptions) -> Result<PathBuf, ServiceError> {
    // preparation, e.g. in later features some log commands can be added / excluded per users request or
    let commands = options.commands;
    let paths = options.paths;
    let opt_dest = options.destination.into_os_string();
    let destination = opt_dest
        .to_str()
        .ok_or(ServiceError::CannotGenerateLogs(String::from(
            "Cannot collect the logs",
        )))?;
    let result = format!("{}.{}", destination, DEFAULT_COMPRESSION.1);

    // create temporary directory where to collect all files (similar to what old save_y2logs
    // does)
    let tmp_dir = TempDir::with_prefix(TMP_DIR_PREFIX)
        .map_err(|_| ServiceError::CannotGenerateLogs(String::from("Cannot collect the logs")))?;
    let mut log_sources = paths_to_log_sources(&paths, &tmp_dir);

    log_sources.append(&mut cmds_to_log_sources(&commands, &tmp_dir));

    // some info can be collected via particular commands only
    // store it
    for log in log_sources.iter() {
        // for now keep directory structure close to the original
        // e.g. what was in /etc will be in /<tmp dir>/etc/
        if fs::create_dir_all(log.to().parent().unwrap()).is_ok() {
            // if storing of one particular log fails, just ignore it
            // file might be missing e.g. bcs the tool doesn't generate it anymore, ...
            let _ = log.store().is_err();
        } else {
            return Err(ServiceError::CannotGenerateLogs(String::from(
                "Cannot collect the logs",
            )));
        }
    }

    if compress_logs(&tmp_dir, &result).is_err() {
        return Err(ServiceError::CannotGenerateLogs(String::from(
            "Cannot collect the logs",
        )));
    }

    Ok(PathBuf::from(result))
}

#[derive(Serialize, serde::Deserialize, ToSchema)]
pub struct LogsLists {
    pub commands: Vec<String>,
    pub files: Vec<String>,
}

/// Handler for the "agama logs list" subcommand
pub fn list(options: LogOptions) -> LogsLists {
    LogsLists {
        commands: options.commands.iter().map(|c| c.0.clone()).collect(),
        files: options.paths.clone(),
    }
}
