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

//! This module implements a set of utilities for tests.

use crate::{
    client::{Error, ISCSIClient},
    service::{Service, Starter},
    storage,
};
use agama_utils::{
    actor::Handler,
    api::{
        event,
        iscsi::{Config, DiscoverConfig},
    },
    progress,
};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Default, Clone)]
pub struct TestClientState {
    pub discovered: bool,
    pub config: Option<Config>,
}

/// iSCSI test client.
///
/// This client implements a dummy client to replace the original [ISCSIClient].
///
/// ```
/// use agama_iscsi::{test_utils::TestClient, client::ISCSIClient};
/// use agama_utils::{api::iscsi::DiscoverConfig};
///
/// # tokio_test::block_on(async {
///
/// // Assert whether the main methods were called.
/// let client = TestClient::new();
/// assert_eq!(client.state().await.discovered, false);
///
/// let config = DiscoverConfig::new("192.168.100.10", 3260);
/// client.discover(config).await.unwrap();
/// assert_eq!(client.state().await.discovered, true);
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
impl ISCSIClient for TestClient {
    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let system: Value = serde_json::from_str(
            r#"
            {
                "targets": [
                    { "name": "target.test" }
                 ]
            }
            "#,
        )
        .unwrap();

        Ok(Some(system))
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn set_config(&self, config: Option<Config>) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.config = config;
        Ok(())
    }

    async fn discover(&self, _config: DiscoverConfig) -> Result<u32, Error> {
        let mut state = self.state.lock().await;
        state.discovered = true;
        Ok(0)
    }
}

/// Starts a testing storage service.
pub async fn start_service(
    storage: Handler<storage::Service>,
    events: event::Sender,
    progress: Handler<progress::Service>,
    connection: zbus::Connection,
) -> Handler<Service> {
    let client = TestClient::new();
    Starter::new(storage, events, progress, connection)
        .with_client(client)
        .start()
        .await
        .expect("Could not start a testing iSCSI service")
}
