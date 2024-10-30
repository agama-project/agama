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

use agama_lib::error::ServiceError;
use axum::body::{to_bytes, Body};
use std::{
    future::Future,
    process::{Child, Command},
    time::Duration,
};

use uuid::Uuid;

/// D-Bus server to be used on tests.
///
/// Takes care of starting and stopping a dbus-daemon to be used on integration tests. Each server
/// uses a different socket, so they do not collide.
///
/// NOTE: this struct implements the [typestate pattern](http://cliffle.com/blog/rust-typestate/).
pub struct DBusServer<S: ServerState> {
    address: String,
    extra: S,
}

pub struct Started {
    connection: zbus::Connection,
    child: Child,
}

impl Drop for Started {
    fn drop(&mut self) {
        self.child.kill().unwrap();
    }
}

pub struct Stopped;

pub trait ServerState {}
impl ServerState for Started {}
impl ServerState for Stopped {}

impl Default for DBusServer<Stopped> {
    fn default() -> Self {
        Self::new()
    }
}

impl DBusServer<Stopped> {
    pub fn new() -> Self {
        let uuid = Uuid::new_v4();
        DBusServer {
            address: format!("unix:path=/tmp/agama-tests-{uuid}"),
            extra: Stopped,
        }
    }

    pub async fn start(self) -> Result<DBusServer<Started>, ServiceError> {
        let child = Command::new("/usr/bin/dbus-daemon")
            .args([
                "--config-file",
                "../share/dbus-test.conf",
                "--address",
                &self.address,
            ])
            .spawn()
            .expect("to start the testing D-Bus daemon");

        let connection = async_retry(|| agama_lib::connection_to(&self.address)).await?;

        Ok(DBusServer {
            address: self.address,
            extra: Started { child, connection },
        })
    }
}

impl DBusServer<Started> {
    pub fn connection(&self) -> zbus::Connection {
        self.extra.connection.clone()
    }
}

/// Run and retry an async function.
///
/// Beware that, if the function is failing for a legit reason, you will
/// introduce a delay in your code.
///
/// * `func`: async function to run.
pub async fn async_retry<O, F, T, E>(func: F) -> Result<T, E>
where
    F: Fn() -> O,
    O: Future<Output = Result<T, E>>,
{
    const RETRIES: u8 = 10;
    const INTERVAL: u64 = 500;
    let mut retry = 0;
    loop {
        match func().await {
            Ok(result) => return Ok(result),
            Err(error) => {
                if retry > RETRIES {
                    return Err(error);
                }
                retry += 1;
                let wait_time = Duration::from_millis(INTERVAL);
                tokio::time::sleep(wait_time).await;
            }
        }
    }
}

pub async fn body_to_string(body: Body) -> String {
    let bytes = to_bytes(body, usize::MAX).await.unwrap();
    String::from_utf8(bytes.to_vec()).unwrap()
}
