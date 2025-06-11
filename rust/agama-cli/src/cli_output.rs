// Copyright (c) [2025] SUSE LLC
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

use anyhow::Context;
use std::io::Write;
use std::path::PathBuf;

/// Represents the ways user can specify the output for the command line.
#[derive(Clone, Debug)]
pub enum CliOutput {
    Path(PathBuf),
    /// Specified as `-` by the user
    Stdout,
}

impl From<String> for CliOutput {
    fn from(path: String) -> Self {
        if path == "-" {
            Self::Stdout
        } else {
            Self::Path(path.into())
        }
    }
}

impl CliOutput {
    // consumes self, otherwise
    // foo.write(&data); foo.write("\n"); would leave just \n
    pub fn write(self, contents: &str) -> anyhow::Result<()> {
        match self {
            Self::Stdout => {
                let mut stdout = std::io::stdout().lock();
                stdout.write_all(contents.as_bytes())?;
                stdout.flush()?
            }
            Self::Path(path) => {
                let mut file = std::fs::OpenOptions::new()
                    .create(true)
                    .truncate(true)
                    .write(true)
                    .open(&path)
                    .context(format!("Writing to {:?}", &path))?;
                file.write_all(contents.as_bytes())?
            }
        }
        Ok(())
    }
}
