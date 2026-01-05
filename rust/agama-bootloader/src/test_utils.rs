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

use std::sync::Arc;

use agama_utils::{actor::Handler, api::bootloader::Config, issue};
use async_trait::async_trait;
use tokio::sync::Mutex;

use crate::{
    client::{BootloaderClient, Error},
    service::Starter,
    Service,
};

#[derive(Default, Clone)]
pub struct TestClientState {
    pub config: Config,
}

/// Storage test client.
///
/// This client implements a dummy client to replace the original [StorageClient].
///
/// ```
/// use agama_bootloader::{test_utils::TestClient, client::BootloaderClient};
///
/// # tokio_test::block_on(async {
///
/// // get config from client
/// let client = TestClient::new();
///
/// client.get_config().await.unwrap();
/// # });
/// ```
#[derive(Clone)]
pub struct TestClient {
    state: Arc<Mutex<TestClientState>>,
}

impl TestClient {
    pub fn new() -> Self {
        let state = TestClientState::default();
        Self {
            state: Arc::new(Mutex::new(state)),
        }
    }

    pub async fn state(&self) -> TestClientState {
        self.state.lock().await.clone()
    }
}

#[async_trait]
impl BootloaderClient for TestClient {
    async fn get_config(&self) -> Result<Config, Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn set_config(&self, config: &Config) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.config = config.clone();
        Ok(())
    }
}

/// Starts a testing storage service.
pub async fn start_service(
    issues: Handler<issue::Service>,
    dbus: zbus::Connection,
) -> Handler<Service> {
    let client = TestClient::new();
    Starter::new(dbus, issues)
        .with_client(client)
        .start()
        .await
        .expect("Could not start a testing storage service")
}
