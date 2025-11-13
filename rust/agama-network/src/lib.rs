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

//! Network configuration service for Agama
//!
//! This library implements the network configuration service for Agama.

pub mod action;
pub mod adapter;
pub mod error;
pub mod model;
mod nm;
pub mod start;
pub use start::{start, start_mock};
mod system;
pub mod types;

pub use action::Action;
pub use adapter::{Adapter, NetworkAdapterError};
pub use error::Error;
pub use model::NetworkState;
pub use nm::NetworkManagerAdapter;
pub use system::{NetworkSystem, NetworkSystemClient, NetworkSystemError};
