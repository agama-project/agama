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

use serde::{Deserialize, Serialize};

/// Information about conflict when resolving software
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ConflictSolve {
    /// conflict id
    pub conflict_id: u32,
    /// selected solution id
    pub solution_id: u32,
}

impl From<ConflictSolve> for (u32, u32) {
    fn from(solve: ConflictSolve) -> Self {
        (solve.conflict_id, solve.solution_id)
    }
}

/// Information about possible solution for conflict
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Solution {
    /// conflict id
    pub id: u32,
    /// localized description of solution
    pub description: String,
    /// localized details about solution. Can be missing
    pub details: Option<String>,
}

/// Information about conflict when resolving software
#[derive(Clone, Debug, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Conflict {
    /// conflict id
    pub id: u32,
    /// localized description of conflict
    pub description: String,
    /// localized details about conflict. Can be missing
    pub details: Option<String>,
    /// list of possible solutions
    pub solutions: Vec<Solution>,
}
