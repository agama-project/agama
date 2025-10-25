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
use tokio::sync::mpsc;

/// Localization-related events.
// FIXME: is it really needed to implement Deserialize?
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(tag = "name")]
pub enum Event {
    /// Proposal changed.
    ProposalChanged,
    /// The underlying system changed.
    SystemChanged,
    /// The use configuration changed.
    ConfigChanged,
}

/// Multi-producer single-consumer events sender.
pub type Sender = mpsc::UnboundedSender<Event>;
/// Multi-producer single-consumer events receiver.
pub type Receiver = mpsc::UnboundedReceiver<Event>;
