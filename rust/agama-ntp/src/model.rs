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

use agama_software::Resolvable;
use agama_utils::api::ntp::Config;
use async_trait::async_trait;
use std::io;

pub mod chrony;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Could not read the system configuration")]
    ReadConfig(#[source] io::Error),
    #[error("Failed to write chronyd configuration")]
    WriteConfig(#[source] io::Error),
    #[error("Failed to reload chronyd")]
    Reload(#[source] io::Error),
    #[error("Failed to enable the chronyd service")]
    EnableService(#[source] io::Error),
    #[error("Failed to clean-up the chronyd configuration")]
    RemoveConfig(#[source] io::Error),
    #[error("Failed to synchronize with the NTP server")]
    Sync(#[source] io::Error),
}

#[async_trait]
pub trait ModelAdapter: Send + Sync + 'static {
    /// Gets the system configuration
    fn get_config(&self) -> Result<Config, Error> {
        Ok(Config::default())
    }

    /// Apply the configuration to the current system.
    ///
    /// - `config`: configuration to apply.
    async fn write_config(&self, config: &Config) -> Result<(), Error>;

    /// Synchronize the time using the current configuration.
    ///
    /// Wait until the synchronization is done.
    async fn sync(&self) -> Result<(), Error>;

    /// Write the configuration to the target system.
    ///
    /// - `config`: configuration to apply.
    async fn install(&self, config: &Config) -> Result<(), Error>;

    /// Return the list of required resolvables.
    fn resolvables(&self) -> Vec<Resolvable> {
        vec![]
    }

    /// Remove the configuration from the current system.
    async fn remove_config(&self) -> Result<(), Error>;
}
