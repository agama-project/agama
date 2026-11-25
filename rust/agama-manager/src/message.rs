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

use agama_utils::{
    api::{manager::LicenseContent, Action, Config, IssueMap, Proposal, SystemInfo},
    define_message,
};
use serde_json::Value;

define_message!(
    /// Gets the information of the underlying system.
    GetSystem -> SystemInfo
);

define_message!(
    /// Gets the full config.
    ///
    /// It includes user and default values.
    GetExtendedConfig -> Config
);

define_message!(
    /// Gets the current config set by the user.
    GetConfig -> Config
);

define_message!(
    /// Replaces the config.
    SetConfig { config: Config } -> ()
);

define_message!(
    /// Updates the config.
    UpdateConfig { config: Config } -> ()
);

define_message!(
    /// Gets the proposal.
    GetProposal -> Option<Proposal>
);

define_message!(
    /// Gets the installation issues.
    GetIssues -> IssueMap
);

define_message!(GetLicense { id: String } -> Option<LicenseContent>);

define_message!(
    /// Runs the given action.
    RunAction { action: Action } -> ()
);

define_message!(
    // Gets the storage model.
    GetStorageModel -> Option<Value>
);

define_message!(
    // Sets the storage model.
    SetStorageModel { model: Value } -> ()
);

define_message!(SolveStorageModel { model: Value } -> Option<Value>);
