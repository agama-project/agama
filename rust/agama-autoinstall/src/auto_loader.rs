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

use crate::ConfigLoader;
use agama_lib::http::BaseHTTPClient;
use anyhow::anyhow;

/// List of pre-defined locations for profiles.
const PREDEFINED_LOCATIONS: [&str; 6] = [
    "label://OEMDRV/autoinst.jsonnet",
    "label://OEMDRV/autoinst.json",
    "label://OEMDRV/autoinst.xml",
    "file:///autoinst.jsonnet",
    "file:///autoinst.json",
    "file:///autoinst.xml",
];

/// Loads the configuration for the unattended installation.
///
/// This struct is responsible for finding and loading the configuration
/// for the unattended installation.
///
/// Check the [Self::load] description for further information.
pub struct ConfigAutoLoader {
    http: BaseHTTPClient,
}

impl ConfigAutoLoader {
    /// Builds a new loader.
    ///
    /// * `http`: base client to connect to Agama.
    pub fn new(http: BaseHTTPClient) -> Self {
        Self { http }
    }

    /// Loads the configuration for the unattended installation.
    ///
    /// * If a set of URLs are given, it processes them in interactive mode (asking
    ///   the user upon errors).
    /// * If no users are given, it searches for configuration in a set of predefined
    ///   locations. It does not report problems for these locations.
    ///
    /// See [Self::load] for further information.
    pub async fn load(&self, urls: &Vec<String>) -> anyhow::Result<()> {
        let loader = ConfigLoader::new(self.http.clone())?;
        if urls.is_empty() {
            Self::load_predefined_config(loader).await
        } else {
            Self::load_user_config(loader, &urls).await
        }
    }

    /// Loads configuration files specified by the user.
    async fn load_user_config(loader: ConfigLoader, urls: &[String]) -> anyhow::Result<()> {
        for url in urls {
            loader.load(url, true).await?;
        }
        Ok(())
    }

    /// Loads configuration files from pre-defined locations.
    async fn load_predefined_config(loader: ConfigLoader) -> anyhow::Result<()> {
        for url in PREDEFINED_LOCATIONS {
            match loader.load(&url, false).await {
                Ok(()) => {
                    println!("Configuration loaded from {url}");
                    return Ok(());
                }
                Err(_) => println!("Could not load the configuration from {url}"),
            }
        }
        Err(anyhow!("No configuration was found"))
    }
}
