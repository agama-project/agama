// Copyright (c) [2026] SUSE LLC
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

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::NamedTempFile;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("ipmitool not found")]
    Tool { desc: String },
    #[error("ipmitool command call failed")]
    Command { desc: String },
}

pub struct Ipmi {
    tool: PathBuf,
    device: PathBuf,
}

impl Ipmi {
    const IPMI_STARTED: u8 = 0x07;
    const IPMI_FINISHED: u8 = 0x08;
    const IPMI_ABORTED: u8 = 0x09;
    const IPMI_FAILED: u8 = 0x0A;

    pub fn new(dev: &Path, tool: &Path) -> Self {
        let instance = Self {
            tool: tool.to_path_buf(),
            device: dev.to_path_buf(),
        };

        tracing::info!("IPMI available: {}", instance.is_available());

        instance
    }

    pub fn started(&self) -> Result<(), Error> {
        self.send_command(Self::IPMI_STARTED)
    }

    pub fn finished(&self) -> Result<(), Error> {
        self.send_command(Self::IPMI_FINISHED)
    }

    pub fn aborted(&self) -> Result<(), Error> {
        self.send_command(Self::IPMI_ABORTED)
    }

    pub fn failed(&self) -> Result<(), Error> {
        self.send_command(Self::IPMI_FAILED)
    }

    fn is_available(&self) -> bool {
        fs::metadata(&self.device).is_ok() && fs::metadata(&self.tool).is_ok()
    }

    fn send_command(&self, code: u8) -> Result<(), Error> {
        if !self.is_available() {
            tracing::info!("IPMI not available");
            return Ok(());
        }

        // Create a temporary file that is automatically deleted
        let mut file = match NamedTempFile::new() {
            Ok(f) => f,
            Err(e) => {
                return Err(Error::Tool {
                    desc: format!("ipmitool failed, cannot create temporary event file. {}", e),
                });
            }
        };

        // Write the event string
        let content = format!("0x04 0x1F 0x00 0x6f 0x{:02x} 0x00 0x00\n", code);

        if file.write_all(content.as_bytes()).is_err() {
            return Err(Error::Tool {
                desc: "ipmitool failed, cannot create event file".to_string(),
            });
        }

        // Execute ipmitool
        let status = Command::new(&self.tool)
            .arg("event")
            .arg("file")
            .arg(file.path())
            .status();

        match status {
            Ok(s) => {
                if !s.success() {
                    Err(Error::Command {
                        desc: format!("ipmitool failed, exit code: {:?}", s.code()),
                    })
                } else {
                    Ok(())
                }
            }
            Err(e) => Err(Error::Command {
                desc: format!("ipmitool failed, status: {}", e),
            }),
        }
    }
}

impl Default for Ipmi {
    fn default() -> Self {
        Self::new(Path::new("/dev/ipmi0"), Path::new("/usr/bin/ipmitool"))
    }
}
