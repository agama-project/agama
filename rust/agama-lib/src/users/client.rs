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

//! Implements a client to access Agama's users service.

use super::proxies::{FirstUser as FirstUserFromDBus, RootUser as RootUserFromDBus, Users1Proxy};
use crate::error::ServiceError;
use serde::{Deserialize, Serialize};
use zbus::Connection;

/// Represents the settings for the first user
#[derive(Serialize, Deserialize, Clone, Debug, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FirstUser {
    /// First user's full name
    pub full_name: String,
    /// First user's username
    pub user_name: String,
    /// First user's password (in clear text)
    pub password: String,
    /// Whether the password is hashed (true) or is plain text (false)
    pub hashed_password: bool,
}

impl FirstUser {
    pub fn from_dbus(dbus_data: zbus::Result<FirstUserFromDBus>) -> zbus::Result<Self> {
        let data = dbus_data?;
        Ok(Self {
            full_name: data.0,
            user_name: data.1,
            password: data.2,
            hashed_password: data.3,
        })
    }
}

/// Represents the settings for the first user
#[derive(Serialize, Deserialize, Clone, Debug, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootUser {
    /// Root user password
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    /// Whether the password is hashed (true) or is plain text (false or None)
    pub hashed_password: Option<bool>,
    /// SSH public key
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ssh_public_key: Option<String>,
}

impl RootUser {
    pub fn from_dbus(dbus_data: RootUserFromDBus) -> zbus::Result<Self> {
        let password = if dbus_data.0.is_empty() {
            None
        } else {
            Some(dbus_data.0)
        };

        let ssh_public_key = if dbus_data.2.is_empty() {
            None
        } else {
            Some(dbus_data.2)
        };

        Ok(Self {
            password,
            hashed_password: Some(dbus_data.1),
            ssh_public_key,
        })
    }
}

/// D-Bus client for the users service
#[derive(Clone)]
pub struct UsersClient<'a> {
    users_proxy: Users1Proxy<'a>,
}

impl<'a> UsersClient<'a> {
    pub async fn new(connection: Connection) -> zbus::Result<UsersClient<'a>> {
        Ok(Self {
            users_proxy: Users1Proxy::new(&connection).await?,
        })
    }

    /// Returns the settings for first non admin user
    pub async fn first_user(&self) -> zbus::Result<FirstUser> {
        FirstUser::from_dbus(self.users_proxy.first_user().await)
    }

    pub async fn root_user(&self) -> zbus::Result<RootUser> {
        RootUser::from_dbus(self.users_proxy.root_user().await?)
    }

    /// SetRootPassword method
    pub async fn set_root_password(&self, value: &str, hashed: bool) -> Result<u32, ServiceError> {
        Ok(self.users_proxy.set_root_password(value, hashed).await?)
    }

    pub async fn remove_root_password(&self) -> Result<u32, ServiceError> {
        Ok(self.users_proxy.remove_root_password().await?)
    }

    /// SetRootSSHKey method
    pub async fn set_root_sshkey(&self, value: &str) -> Result<u32, ServiceError> {
        Ok(self.users_proxy.set_root_sshkey(value).await?)
    }

    /// Set the configuration for the first user
    pub async fn set_first_user(
        &self,
        first_user: &FirstUser,
    ) -> zbus::Result<(bool, Vec<String>)> {
        self.users_proxy
            .set_first_user(
                &first_user.full_name,
                &first_user.user_name,
                &first_user.password,
                first_user.hashed_password,
                std::collections::HashMap::new(),
            )
            .await
    }

    pub async fn remove_first_user(&self) -> zbus::Result<bool> {
        Ok(self.users_proxy.remove_first_user().await? == 0)
    }
}
