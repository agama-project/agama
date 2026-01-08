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

//! This module implements a set of utilities for tests.

use agama_utils::{actor::Handler, api::event, issue, progress};
use async_trait::async_trait;

use crate::{
    adapter::Watcher, model::StateConfig, Adapter, NetworkAdapterError, NetworkState,
    NetworkSystemClient, Starter,
};

/// Network adapter for tests.
///
/// At this point, the adapter returns the default network state and does not write
/// any change. Additionally, it does not have an associated watcher.
pub struct TestAdapter;

#[async_trait]
impl Adapter for TestAdapter {
    async fn read(&self, _config: StateConfig) -> Result<NetworkState, NetworkAdapterError> {
        Ok(NetworkState::default())
    }

    async fn write(&self, _network: &NetworkState) -> Result<(), NetworkAdapterError> {
        Ok(())
    }

    fn watcher(&self) -> Option<Box<dyn Watcher + Send>> {
        None
    }
}

/// Starts a testing network service.
pub async fn start_service(
    events: event::Sender,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
) -> NetworkSystemClient {
    let adapter = TestAdapter;

    Starter::new(events, issues, progress)
        .with_adapter(adapter)
        .start()
        .await
        .expect("Could not spawn a testing network service")
}
