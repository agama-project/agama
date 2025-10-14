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

use crate::types::progress::Progress;
use crate::types::scope::Scope;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Event {
    // The state of the installation changed.
    StateChanged,
    /// Progress changed.
    ProgressChanged {
        scope: Scope,
        progress: Progress,
    },
    /// Progress finished.
    ProgressFinished {
        scope: Scope,
    },
    /// The list of issues has changed.
    IssuesChanged {
        scope: Scope,
    },
    /// The underlying system changed.
    SystemChanged {
        scope: Scope,
    },
    /// Proposal changed.
    ProposalChanged {
        scope: Scope,
    },
}

pub type Sender = broadcast::Sender<Event>;
pub type Receiver = broadcast::Receiver<Event>;
