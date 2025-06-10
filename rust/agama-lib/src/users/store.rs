// Copyright (c) [2024-2025] SUSE LLC
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

use super::{
    http_client::UsersHTTPClientError, settings::UserPassword, FirstUser, FirstUserSettings,
    RootUserSettings, UserSettings, UsersHTTPClient,
};
use crate::http::BaseHTTPClient;

#[derive(Debug, thiserror::Error)]
#[error("Error processing users options: {0}")]
pub struct UsersStoreError(#[from] UsersHTTPClientError);

type UsersStoreResult<T> = Result<T, UsersStoreError>;

/// Loads and stores the users settings from/to the D-Bus service.
pub struct UsersStore {
    users_client: UsersHTTPClient,
}

impl UsersStore {
    pub fn new(client: BaseHTTPClient) -> Self {
        Self {
            users_client: UsersHTTPClient::new(client),
        }
    }

    pub fn new_with_client(client: UsersHTTPClient) -> UsersStoreResult<Self> {
        Ok(Self {
            users_client: client,
        })
    }

    pub async fn load(&self) -> UsersStoreResult<UserSettings> {
        let first_user = self.users_client.first_user().await?;
        let user_password = UserPassword {
            password: first_user.password,
            hashed_password: first_user.hashed_password,
        };
        let first_user = FirstUserSettings {
            user_name: Some(first_user.user_name),
            full_name: Some(first_user.full_name),
            password: if user_password.password.is_empty() {
                None
            } else {
                Some(user_password)
            },
        };
        let root_user = self.users_client.root_user().await?;
        let root_password = root_user.password.map(|password| UserPassword {
            password,
            hashed_password: root_user.hashed_password.unwrap_or_default(),
        });
        let root_user = RootUserSettings {
            password: root_password,
            ssh_public_key: root_user.ssh_public_key,
        };

        Ok(UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        })
    }

    pub async fn store(&self, settings: &UserSettings) -> UsersStoreResult<()> {
        // fixme: improve
        if let Some(settings) = &settings.first_user {
            self.store_first_user(settings).await?;
        }

        if let Some(settings) = &settings.root {
            self.store_root_user(settings).await?;
        }
        Ok(())
    }

    async fn store_first_user(&self, settings: &FirstUserSettings) -> UsersStoreResult<()> {
        let first_user = FirstUser {
            user_name: settings.user_name.clone().unwrap_or_default(),
            full_name: settings.full_name.clone().unwrap_or_default(),
            password: settings
                .password
                .as_ref()
                .map(|p| p.password.clone())
                .unwrap_or_default(),
            hashed_password: settings
                .password
                .as_ref()
                .map(|p| p.hashed_password)
                .unwrap_or_default(),
        };
        Ok(self.users_client.set_first_user(&first_user).await?)
    }

    async fn store_root_user(&self, settings: &RootUserSettings) -> UsersStoreResult<()> {
        if let Some(password) = &settings.password {
            self.users_client
                .set_root_password(&password.password, password.hashed_password)
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
    use crate::http::BaseHTTPClient;
    use httpmock::prelude::*;
    use httpmock::Method::PATCH;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    fn users_store(mock_server_url: String) -> UsersStoreResult<UsersStore> {
        let bhc =
            BaseHTTPClient::new(mock_server_url).map_err(|e| UsersHTTPClientError::HTTP(e))?;
        let client = UsersHTTPClient::new(bhc.clone());
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
                    "sshPublicKey": "keykeykey",
                    "password": "nots3cr3t",
                    "hashedPassword": false
                }"#,
                );
        });
        let url = server.url("/api");

        let store = users_store(url)?;
        let settings = store.load().await?;

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some(UserPassword {
                password: "fish".to_owned(),
                hashed_password: false,
            }),
        };
        let root_user = RootUserSettings {
            // FIXME this is weird: no matter what HTTP reports, we end up with None
            password: Some(UserPassword {
                password: "nots3cr3t".to_owned(),
                hashed_password: false,
            }),
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
                .body(r#"{"sshPublicKey":null,"password":"1234","hashedPassword":false}"#);
            then.status(200).body("0");
        });
        let root_mock2 = server.mock(|when, then| {
            when.method(PATCH)
                .path("/api/users/root")
                .header("content-type", "application/json")
                .body(r#"{"sshPublicKey":"keykeykey","password":null,"hashedPassword":null}"#);
            then.status(200).body("0");
        });
        let url = server.url("/api");

        let store = users_store(url)?;

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some(UserPassword {
                password: "fish".to_owned(),
                hashed_password: false,
            }),
        };
        let root_user = RootUserSettings {
            password: Some(UserPassword {
                password: "1234".to_owned(),
                hashed_password: false,
            }),
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
