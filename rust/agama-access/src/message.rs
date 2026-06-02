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

//! Defines the messages that can be handled by the remote access service.

use agama_utils::{
    actor::Message,
    api::access::{Config, ExtendedConfig},
};

/// Message to retrieve the current user-provided remote access configuration.
#[derive(Clone)]
pub struct GetConfig;

impl Message for GetConfig {
    type Reply = Config;
}

/// Message to set the user-provided remote access configuration.
pub struct SetConfig<T> {
    /// The configuration payload to apply.
    pub config: Option<T>,
}

impl<T: Send + 'static> Message for SetConfig<T> {
    type Reply = ();
}

impl<T> SetConfig<T> {
    /// Creates a new `SetConfig` message.
    ///
    /// * `config`: The optional configuration to set.
    pub fn new(config: Option<T>) -> Self {
        Self { config }
    }
}

/// Message to set remote access requirements from other parts of Agama.
///
/// Other components (like the `agama-users` module) use this message to ensure
/// that a specific remote access mechanism (like SSH) gets enabled when needed.
pub struct SetAccess {
    /// Module identifier (e.g., `"users"`).
    pub id: String,
    /// The requested remote access configuration from the module.
    pub config: Config,
}

impl Message for SetAccess {
    type Reply = ();
}

impl SetAccess {
    /// Creates a new `SetAccess` message.
    ///
    /// * `id`: String identifier for the requesting module.
    /// * `config`: The configuration requested by the module.
    pub fn new(id: String, config: Config) -> Self {
        Self { id, config }
    }
}

/// Message to retrieve the resolved remote access configuration proposal.
///
/// The proposal is the resolved configuration computed from internal Agama needs
/// and the explicit user configuration.
#[derive(Clone)]
pub struct GetProposal;

impl Message for GetProposal {
    type Reply = ExtendedConfig;
}

/// Execute actions at the end of the installation.
#[derive(Clone)]
pub struct Finish;

impl Message for Finish {
    type Reply = ();
}
