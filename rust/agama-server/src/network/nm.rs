// Copyright (c) [2024] SUSE LLC
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

//! Support for interacting with [NetworkManager](https://networkmanager.dev/).
//!
//! This module defines [a NetworkManager client](client::NetworkManagerClient) and a set of
//! structs and enums to work with NetworkManager configuration. It is intended to be used
//! internally, so the API is focused on Agama's use cases.

mod adapter;
mod builder;
mod client;
mod dbus;
mod error;
mod model;
mod proxies;
mod watcher;

pub use adapter::NetworkManagerAdapter;
pub use client::NetworkManagerClient;
pub use watcher::NetworkManagerWatcher;
