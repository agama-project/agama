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

use std::collections::HashMap;

use serde::Serialize;

/// Represents the reason why a pattern is selected.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, utoipa::ToSchema)]
pub enum SelectedBy {
    /// The pattern was selected by the user.
    User,
    /// The pattern was selected automatically.
    Auto,
    /// The pattern has not be selected.
    None,
}

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
/// Software proposal information.
pub struct SoftwareProposal {
    /// Space required for installation. It is returned as a formatted string which includes
    /// a number and a unit (e.g., "GiB").
    pub size: String,
    /// Patterns selection. It is represented as a hash map where the key is the pattern's name
    /// and the value why the pattern is selected.
    pub patterns: HashMap<String, SelectedBy>,
}

/// Describes what Agama proposes for the target system.
#[derive(Clone, Debug, Serialize)]
pub struct Proposal {
    /// Software specific proposal
    #[serde(skip_serializing_if = "Option::is_none")]
    software: Option<SoftwareProposal>,
    /// Registration proposal. Maybe same as config?
    /// TODO: implement it
    #[serde(skip_serializing_if = "Option::is_none")]
    registration: Option<()>,
}
