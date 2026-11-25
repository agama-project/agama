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
    api::access::{Config, ExtendedConfig},
    define_message,
};

define_message!(
    /// Message to retrieve the current user-provided remote access configuration.
    GetConfig -> Config
);

define_message!(
    /// Message to set the user-provided remote access configuration.
    SetConfig<T> { config: Option<T> } -> ()
);

define_message!(
    /// Message to set remote access requirements from other parts of Agama.
    ///
    /// Other components (like the `agama-users` module) use this message to ensure
    /// that a specific remote access mechanism (like SSH) gets enabled when needed.
    SetAccess { id: String, config: Config } -> ()
);

define_message!(
    /// Message to retrieve the resolved remote access configuration proposal.
    ///
    /// The proposal is the resolved configuration computed from internal Agama needs
    /// and the explicit user configuration.
    GetProposal -> ExtendedConfig
);

define_message!(
    /// Execute actions at the end of the installation.
    Finish -> ()
);
