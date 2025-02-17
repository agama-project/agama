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

use super::{FirstUser, FirstUserSettings, RootUserSettings, UserSettings, UsersHTTPClient};
use crate::base_http_client::BaseHTTPClient;
use crate::error::ServiceError;

/// Loads and stores the users settings from/to the D-Bus service.
pub struct UsersStore {
    users_client: UsersHTTPClient,
}

impl UsersStore {
    pub fn new(client: BaseHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self {
            users_client: UsersHTTPClient::new(client)?,
        })
    }

    pub fn new_with_client(client: UsersHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self {
            users_client: client,
        })
    }

    pub async fn load(&self) -> Result<UserSettings, ServiceError> {
        let first_user = self.users_client.first_user().await?;
        let first_user = FirstUserSettings {
            user_name: Some(first_user.user_name),
            full_name: Some(first_user.full_name),
            password: Some(first_user.password),
            hashed_password: Some(first_user.hashed_password),
        };
        let root_user = RootUserSettings::default();
        let root_user = RootUserSettings {
            password: root_user.password,
            hashed_password: root_user.hashed_password,
            ssh_public_key: root_user.ssh_public_key,
        };

        Ok(UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        })
    }

    pub async fn store(&self, settings: &UserSettings) -> Result<(), ServiceError> {
        // fixme: improve
        if let Some(settings) = &settings.first_user {
            self.store_first_user(settings).await?;
        }

        if let Some(settings) = &settings.root {
            self.store_root_user(settings).await?;
        }
        Ok(())
    }

    async fn store_first_user(&self, settings: &FirstUserSettings) -> Result<(), ServiceError> {
        let first_user = FirstUser {
            user_name: settings.user_name.clone().unwrap_or_default(),
            full_name: settings.full_name.clone().unwrap_or_default(),
            password: settings.password.clone().unwrap_or_default(),
            hashed_password: settings.hashed_password.unwrap_or_default(),
        };
        self.users_client.set_first_user(&first_user).await
    }

    async fn store_root_user(&self, settings: &RootUserSettings) -> Result<(), ServiceError> {
        let hashed_password = settings.hashed_password.unwrap_or_default();

        if let Some(root_password) = &settings.password {
            self.users_client
                .set_root_password(root_password, hashed_password)
                .await?;
        }

        if let Some(ssh_public_key) = &settings.ssh_public_key {
            self.users_client.set_root_sshkey(ssh_public_key).await?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use httpmock::Method::PATCH;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn users_store(mock_server_url: String) -> Result<UsersStore, ServiceError> {
        let mut bhc = BaseHTTPClient::default();
        bhc.base_url = mock_server_url;
        let client = UsersHTTPClient::new(bhc)?;
        UsersStore::new_with_client(client)
    }

    #[test]
    async fn test_getting_users() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let user_mock = server.mock(|when, then| {
            when.method(GET).path("/api/users/first");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "fullName": "Tux",
                    "userName": "tux",
                    "password": "fish",
                    "hashedPassword": false
                }"#,
                );
        });
        let root_mock = server.mock(|when, then| {
            when.method(GET).path("/api/users/root");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "sshkey": "keykeykey",
                    "password": true
                }"#,
                );
        });
        let url = server.url("/api");

        let store = users_store(url)?;
        let settings = store.load().await?;

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some("fish".to_owned()),
            hashed_password: Some(false),
        };
        let root_user = RootUserSettings {
            // FIXME this is weird: no matter what HTTP reports, we end up with None
            password: None,
            hashed_password: None,
            ssh_public_key: Some("keykeykey".to_owned()),
        };
        let expected = UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        };

        // main assertion
        assert_eq!(settings, expected);

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        user_mock.assert();
        root_mock.assert();

        Ok(())
    }

    #[test]
    async fn test_setting_users() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let user_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/users/first")
                .header("content-type", "application/json")
                .body(r#"{"fullName":"Tux","userName":"tux","password":"fish","hashedPassword":false}"#);
            then.status(200);
        });
        // note that we use 2 requests for root
        let root_mock = server.mock(|when, then| {
            when.method(PATCH)
                .path("/api/users/root")
                .header("content-type", "application/json")
                .body(r#"{"sshkey":null,"password":"1234","hashedPassword":false}"#);
            then.status(200).body("0");
        });
        let root_mock2 = server.mock(|when, then| {
            when.method(PATCH)
                .path("/api/users/root")
                .header("content-type", "application/json")
                .body(r#"{"sshkey":"keykeykey","password":null,"hashedPassword":null}"#);
            then.status(200).body("0");
        });
        let url = server.url("/api");

        let store = users_store(url)?;

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some("fish".to_owned()),
            hashed_password: Some(false),
        };
        let root_user = RootUserSettings {
            password: Some("1234".to_owned()),
            hashed_password: Some(false),
            ssh_public_key: Some("keykeykey".to_owned()),
        };
        let settings = UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        };
        let result = store.store(&settings).await;

        // main assertion
        result?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        user_mock.assert();
        root_mock.assert();
        root_mock2.assert();
        Ok(())
    }
}
