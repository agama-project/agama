// Copyright (c) [2025-2026] SUSE LLC
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

use agama_utils::{
    actor::Handler,
    api::{event, storage::Config, Issue},
    issue,
    products::ProductSpec,
    progress,
};
use async_trait::async_trait;
use serde_json::Value;
use tokio::sync::{Mutex, RwLock};

use crate::{
    client::{Error, StorageClient},
    service::Starter,
    Service,
};

#[derive(Default, Clone)]
pub struct TestClientState {
    pub probed: bool,
    pub installed: bool,
    pub finished: bool,
    pub umounted: bool,
    pub config: Option<Config>,
}

/// Storage test client.
///
/// This client implements a dummy client to replace the original [StorageClient].
///
/// ```
/// use agama_storage::{test_utils::TestClient, client::StorageClient};
///
/// # tokio_test::block_on(async {
///
/// // Assert whether the main methods were called.
/// let client = TestClient::new();
/// assert_eq!(client.state().await.probed, false);
///
/// client.probe().await.unwrap();
/// assert_eq!(client.state().await.probed, true);
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
impl StorageClient for TestClient {
    async fn activate(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn probe(&self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.probed = true;
        Ok(())
    }

    async fn install(&self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.installed = true;
        Ok(())
    }

    async fn finish(&self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.finished = true;
        Ok(())
    }

    async fn umount(&self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.umounted = true;
        Ok(())
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_config(&self) -> Result<Option<Config>, Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn get_config_from_model(&self, _model: Value) -> Result<Option<Config>, Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn get_config_model(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_proposal(&self) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn get_issues(&self) -> Result<Vec<Issue>, Error> {
        Ok(vec![])
    }

    async fn set_config(
        &self,
        _product: Arc<RwLock<ProductSpec>>,
        config: Option<Config>,
    ) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.config = config;
        Ok(())
    }

    async fn solve_config_model(&self, _model: Value) -> Result<Option<Value>, Error> {
        Ok(None)
    }

    async fn set_locale(&self, _locale: String) -> Result<(), Error> {
        Ok(())
    }
}

/// Starts a testing storage service.
pub async fn start_service(
    events: event::Sender,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    dbus: zbus::Connection,
) -> Handler<Service> {
    let client = TestClient::new();
    Starter::new(events, issues, progress, dbus)
        .with_client(client)
        .start()
        .await
        .expect("Could not start a testing storage service")
}
