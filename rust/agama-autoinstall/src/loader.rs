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

use std::{io::Write, process::Stdio};

use anyhow::anyhow;

/// It loads the an Agama configuration.
///
/// This struct is responsible for reading the configuration from a given URL.
///
/// It relies on Agama's command-line to generate and load the new
/// configuration. In the future, it could rely directly on Agama libraries
/// instead of the command-line.
#[derive(Default)]
pub struct ConfigLoader;

impl ConfigLoader {
    /// Loads the configuration from the given URL.
    pub async fn load(&self, url: &str) -> anyhow::Result<()> {
        let generate_cmd = std::process::Command::new("agama")
            .env("YAST_SKIP_PROFILE_FETCH_ERROR", "1")
            .env("YAST_SKIP_XML_VALIDATION", "1")
            .args(["config", "generate", url])
            .output()?;

        if !generate_cmd.status.success() {
            return Err(anyhow!(
                "Could not run generate the configuration: {:?}",
                generate_cmd.stderr,
            ));
        }

        let child = std::process::Command::new("agama")
            .args(["config", "load"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = child?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or(anyhow!("Could not write to \"config load\" stdin"))?;
        stdin.write_all(&generate_cmd.stdout)?;
        drop(stdin);

        let config_cmd = child.wait_with_output()?;
        if !config_cmd.status.success() {
            let message = String::from_utf8_lossy(&config_cmd.stderr);
            return Err(anyhow!("Could not load the configuration: {}", message));
        }

        Ok(())
    }
}
