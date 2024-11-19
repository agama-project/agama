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

use super::client::FirstUser;
use crate::base_http_client::{BaseHTTPClient, BaseHTTPClientError};
use crate::users::model::{RootConfig, RootPatchSettings};

pub struct UsersHTTPClient {
    client: BaseHTTPClient,
}

impl UsersHTTPClient {
    pub fn new(client: BaseHTTPClient) -> Result<Self, BaseHTTPClientError> {
        Ok(Self { client })
    }

    /// Returns the settings for first non admin user
    pub async fn first_user(&self) -> Result<FirstUser, BaseHTTPClientError> {
        self.client.get("/users/first").await
    }

    /// Set the configuration for the first user
    pub async fn set_first_user(&self, first_user: &FirstUser) -> Result<(), BaseHTTPClientError> {
        let result = self.client.put_void("/users/first", first_user).await;
        if let Err(BaseHTTPClientError::BackendError(422, ref issues_s)) = result {
            let issues: Vec<String> = serde_json::from_str(issues_s)?;
            return Err(BaseHTTPClientError::Validation(issues));
        }
        result
    }

    async fn root_config(&self) -> Result<RootConfig, BaseHTTPClientError> {
        self.client.get("/users/root").await
    }

    /// Whether the root password is set or not
    pub async fn is_root_password(&self) -> Result<bool, BaseHTTPClientError> {
        let root_config = self.root_config().await?;
        Ok(root_config.password)
    }

    /// SetRootPassword method.
    /// Returns 0 if successful (always, for current backend)
    pub async fn set_root_password(
        &self,
        value: &str,
        encrypted: bool,
    ) -> Result<u32, BaseHTTPClientError> {
        let rps = RootPatchSettings {
            sshkey: None,
            password: Some(value.to_owned()),
            encrypted_password: Some(encrypted),
        };
        let ret = self.client.patch("/users/root", &rps).await?;
        Ok(ret)
    }

    /// Returns the SSH key for the root user
    pub async fn root_ssh_key(&self) -> Result<String, BaseHTTPClientError> {
        let root_config = self.root_config().await?;
        Ok(root_config.sshkey)
    }

    /// SetRootSSHKey method.
    /// Returns 0 if successful (always, for current backend)
    pub async fn set_root_sshkey(&self, value: &str) -> Result<u32, BaseHTTPClientError> {
        let rps = RootPatchSettings {
            sshkey: Some(value.to_owned()),
            password: None,
            encrypted_password: None,
        };
        let ret = self.client.patch("/users/root", &rps).await?;
        Ok(ret)
    }
}
