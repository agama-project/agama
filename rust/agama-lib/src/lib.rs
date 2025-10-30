// Copyright (c) [2024-2025] SUSE LLC
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

//! # Interacting with Agama
//!
//! This library offers an API to interact with Agama services. At this point, the library allows:
//!
//! * Reading and writing [installation settings](install_settings::InstallSettings).
//! * Monitoring the [progress].
//! * Triggering actions through the [manager] (e.g., starting installation).
//!
//! ## Handling installation settings
//!
//! Let's have a look to the components that are involved when dealing with the installation
//! settings, as it is the most complex part of the library. The code is organized in a set of
//! modules, one for each topic.
//!
//! Each of those modules contains, at least:
//!
//! * A settings model: it is a representation of the installation settings for the given topic. It
//!   is expected to implement the [serde::Serialize], [serde::Deserialize] and
//!   [agama_settings::settings::Settings] traits.
//! * A store: it is the responsible for reading/writing the settings to the service. Usually, it
//!   relies on a D-Bus client for communicating with the service, although it could implement that
//!   logic itself. Note: we are considering defining a trait for stores too.
//!
//! As said, those modules might implement additional stuff, like specific types, clients, etc.

pub mod auth;
pub mod bootloader;
pub mod context;
pub mod error;
pub mod file_source;
pub mod files;
pub mod hostname;
pub mod http;
pub mod install_settings;
pub use agama_utils::issue;
pub mod jobs;
pub mod logs;
pub mod manager;
pub mod monitor;
pub mod network;
pub mod profile;
pub mod progress;
pub mod proxies;
pub mod questions;
pub mod scripts;
pub mod security;
pub mod storage;
mod store;
pub mod users;
pub use store::Store;
pub mod utils;
pub use agama_utils::{dbus, openapi};

use crate::error::ServiceError;
use zbus::conn::Builder;

const ADDRESS: &str = "unix:path=/run/agama/bus";

pub async fn connection() -> Result<zbus::Connection, ServiceError> {
    connection_to(ADDRESS).await
}

pub async fn connection_to(address: &str) -> Result<zbus::Connection, ServiceError> {
    let connection = Builder::address(address)?
        .build()
        .await
        .map_err(|e| ServiceError::DBusConnectionError(address.to_string(), e))?;
    Ok(connection)
}
