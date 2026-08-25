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

use agama_lib::{
    http::BaseHTTPClient,
    profile::{is_autoyast_path, AutoyastConversionResult, ProfileHTTPClient},
};
use anyhow::anyhow;
use fluent_uri::Uri;

/// It loads the an Agama configuration.
///
/// This struct is responsible for reading the configuration from a given URL.
///
/// For AutoYaST sources, it talks to Agama's HTTP API directly so that any
/// conversion problem can be surfaced to the caller. For everything else, it
/// relies on Agama's command-line to generate and load the new configuration.
pub struct ConfigLoader {
    http: BaseHTTPClient,
    insecure: bool,
}

impl ConfigLoader {
    pub fn new(http: BaseHTTPClient, insecure: bool) -> Self {
        Self { http, insecure }
    }

    /// Whether the given URL looks like an AutoYaST profile source.
    pub fn is_autoyast(&self, url: &str) -> bool {
        let path = Uri::parse(url)
            .map(|u| u.path().to_string())
            .unwrap_or_default();
        is_autoyast_path(&path)
    }

    /// Fetches and converts an AutoYaST profile, without loading it.
    ///
    /// The caller is responsible for deciding what to do with the conversion
    /// problems (if any) before calling [Self::load_json] with the result.
    pub async fn fetch_autoyast(&self, url: &str) -> anyhow::Result<AutoyastConversionResult> {
        let uri = Uri::parse(url.to_string()).map_err(|(e, _)| e)?;
        let result = ProfileHTTPClient::new(self.http.clone())
            .from_autoyast(&uri)
            .await?;
        Ok(result)
    }

    /// Loads the configuration from the given URL.
    pub async fn load(&self, url: &str) -> anyhow::Result<()> {
        let mut generate_args = vec!["config", "generate", url];
        if self.insecure {
            generate_args.insert(0, "--insecure");
        }

        let generate_cmd = std::process::Command::new("agama")
            .env("YAST_SKIP_PROFILE_FETCH_ERROR", "1")
            .env("YAST_SKIP_XML_VALIDATION", "1")
            .args(generate_args)
            .output()?;

        if !generate_cmd.status.success() {
            let message = String::from_utf8_lossy(&generate_cmd.stderr);
            return Err(anyhow!("Could not generate the configuration: {}", message));
        }

        self.load_json_bytes(&generate_cmd.stdout)
    }

    /// Loads an already fetched JSON configuration (e.g., from [Self::fetch_autoyast]).
    pub fn load_json(&self, json: &str) -> anyhow::Result<()> {
        self.load_json_bytes(json.as_bytes())
    }

    fn load_json_bytes(&self, json: &[u8]) -> anyhow::Result<()> {
        let mut load_args = vec!["config", "load"];
        if self.insecure {
            load_args.insert(0, "--insecure");
        }

        let child = std::process::Command::new("agama")
            .args(load_args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn();
        let mut child = child?;
        let mut stdin = child
            .stdin
            .take()
            .ok_or(anyhow!("Could not write to \"config load\" stdin"))?;
        stdin.write_all(json)?;
        drop(stdin);

        let config_cmd = child.wait_with_output()?;
        if !config_cmd.status.success() {
            let message = String::from_utf8_lossy(&config_cmd.stderr);
            return Err(anyhow!("Could not load the configuration: {}", message));
        }

        Ok(())
    }
}
