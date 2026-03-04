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
    dasd::client::{DASDClient, Error},
    service::{Service, Starter},
    storage,
    zfcp::{self, client::ZFCPClient},
};
use agama_utils::{
    actor::Handler,
    api::{event, RawConfig},
    issue, progress,
};
use async_trait::async_trait;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Default, Clone)]
pub struct TestDASDClientState {
    pub probed: bool,
    pub config: Option<RawConfig>,
}

/// Test client for DASD.
///
/// This client implements a dummy client to replace the original [DASDClient].
///
/// ```
/// use agama_s390::{test_utils::TestDASDClient, dasd::client::DASDClient};
///
/// # tokio_test::block_on(async {
///
/// // Assert whether the main methods were called.
/// let client = TestDASDClient::new();
/// assert_eq!(client.state().await.probed, false);
///
/// client.probe().await.unwrap();
/// assert_eq!(client.state().await.probed, true);
/// # });
/// ```
#[derive(Clone)]
pub struct TestDASDClient {
    state: Arc<Mutex<TestDASDClientState>>,
}

impl Default for TestDASDClient {
    fn default() -> Self {
        Self::new()
    }
}

impl TestDASDClient {
    pub fn new() -> Self {
        let state = TestDASDClientState::default();
        Self {
            state: Arc::new(Mutex::new(state)),
        }
    }

    pub async fn state(&self) -> TestDASDClientState {
        self.state.lock().await.clone()
    }
}

#[async_trait]
impl DASDClient for TestDASDClient {
    async fn probe(&self) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.probed = true;
        Ok(())
    }

    async fn get_system(&self) -> Result<Option<Value>, Error> {
        let system: Value = serde_json::from_str(
            r#"
            {
                "devices": [
                    {
                        "channel": "0.0.0100",
                        "deviceName": "dasda",
                        "type": "ECKD",
                        "diag": false,
                        "accessType": "diag",
                        "partitionInfo": "1",
                        "status": "active",
                        "active": true,
                        "formatted": true
                    }
                 ]
            }
            "#,
        )
        .unwrap();

        Ok(Some(system))
    }

    async fn get_config(&self) -> Result<Option<RawConfig>, Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn set_config(&self, config: Option<RawConfig>) -> Result<(), Error> {
        let mut state = self.state.lock().await;
        state.config = config;
        Ok(())
    }
}

#[derive(Default, Clone)]
pub struct TestZFCPClientState {
    pub probed: bool,
    pub config: Option<RawConfig>,
}

/// Test client for zFCP.
///
/// This client implements a dummy client to replace the original [ZFCPClient].
#[derive(Clone)]
pub struct TestZFCPClient {
    state: Arc<Mutex<TestZFCPClientState>>,
}

impl Default for TestZFCPClient {
    fn default() -> Self {
        Self::new()
    }
}

impl TestZFCPClient {
    pub fn new() -> Self {
        let state = TestZFCPClientState::default();
        Self {
            state: Arc::new(Mutex::new(state)),
        }
    }

    pub async fn state(&self) -> TestZFCPClientState {
        self.state.lock().await.clone()
    }
}

#[async_trait]
impl ZFCPClient for TestZFCPClient {
    async fn probe(&self) -> Result<(), zfcp::client::Error> {
        let mut state = self.state.lock().await;
        state.probed = true;
        Ok(())
    }

    async fn get_system(&self) -> Result<Option<Value>, zfcp::client::Error> {
        let system: Value = serde_json::from_str(
            r#"
            {
                "devices": [
                    {
                        "channel": "0.0.1a00",
                        "wwpn": "0x5005076300c20b8e",
                        "lun": "0x0001000000000000",
                        "active": true
                    }
                ]
            }
            "#,
        )
        .unwrap();

        Ok(Some(system))
    }

    async fn get_config(&self) -> Result<Option<RawConfig>, zfcp::client::Error> {
        let state = self.state.lock().await;
        Ok(state.config.clone())
    }

    async fn set_config(&self, config: Option<RawConfig>) -> Result<(), zfcp::client::Error> {
        let mut state = self.state.lock().await;
        state.config = config;
        Ok(())
    }
}

/// Starts a testing s390 service.
pub async fn start_service(
    storage: Handler<storage::Service>,
    events: event::Sender,
    progress: Handler<progress::Service>,
    issues: Handler<issue::Service>,
    connection: zbus::Connection,
) -> Handler<Service> {
    let dasd = TestDASDClient::new();
    let zfcp = TestZFCPClient::new();
    Starter::new(storage, events, progress, issues, connection)
        .with_dasd(dasd)
        .with_zfcp(zfcp)
        .start()
        .await
        .expect("Could not start a testing s390 service")
}
