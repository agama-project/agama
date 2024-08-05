use super::{FirstUser, FirstUserSettings, RootUserSettings, UserSettings, UsersHTTPClient};
use crate::error::ServiceError;

/// Loads and stores the users settings from/to the D-Bus service.
pub struct UsersStore {
    users_client: UsersHTTPClient,
}

impl UsersStore {
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            users_client: UsersHTTPClient::new()?,
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
            autologin: Some(first_user.autologin),
            full_name: Some(first_user.full_name),
            password: Some(first_user.password),
        };
        let mut root_user = RootUserSettings::default();
        let ssh_public_key = self.users_client.root_ssh_key().await?;
        if !ssh_public_key.is_empty() {
            root_user.ssh_public_key = Some(ssh_public_key)
        }
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
            autologin: settings.autologin.unwrap_or_default(),
            password: settings.password.clone().unwrap_or_default(),
            ..Default::default()
        };
        self.users_client.set_first_user(&first_user).await?;
        Ok(())
    }

    async fn store_root_user(&self, settings: &RootUserSettings) -> Result<(), ServiceError> {
        if let Some(root_password) = &settings.password {
            self.users_client
                .set_root_password(root_password, false)
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
        let client = UsersHTTPClient::new_with_base(bhc)?;
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
                    "autologin": true,
                    "data": {}
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

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        user_mock.assert();
        root_mock.assert();

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some("fish".to_owned()),
            autologin: Some(true),
        };
        let root_user = RootUserSettings {
            // FIXME this is weird: no matter what HTTP reports, we end up with None
            password: None,
            ssh_public_key: Some("keykeykey".to_owned()),
        };
        let expected = UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        };

        assert_eq!(settings, expected);
        Ok(())
    }

    #[test]
    async fn test_setting_users() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let user_mock = server.mock(|when, then| {
            when.method(PUT)
                .path("/api/users/first")
                .header("content-type", "application/json")
                .body(
                    r#"{"fullName":"Tux","userName":"tux","password":"fish","autologin":true,"data":{}}"#
                );
            then.status(200);
        });
        // note that we use 2 requests for root
        let root_mock = server.mock(|when, then| {
            when.method(PATCH)
                .path("/api/users/root")
                .header("content-type", "application/json")
                .body(r#"{"sshkey":null,"password":"1234","passwordEncrypted":false}"#);
            then.status(200).body("0");
        });
        let root_mock2 = server.mock(|when, then| {
            when.method(PATCH)
                .path("/api/users/root")
                .header("content-type", "application/json")
                .body(r#"{"sshkey":"keykeykey","password":null,"passwordEncrypted":null}"#);
            then.status(200).body("0");
        });
        let url = server.url("/api");

        let store = users_store(url)?;

        let first_user = FirstUserSettings {
            full_name: Some("Tux".to_owned()),
            user_name: Some("tux".to_owned()),
            password: Some("fish".to_owned()),
            autologin: Some(true),
        };
        let root_user = RootUserSettings {
            password: Some("1234".to_owned()),
            ssh_public_key: Some("keykeykey".to_owned()),
        };
        let settings = UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        };
        let result = store.store(&settings).await;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        user_mock.assert();
        root_mock.assert();
        root_mock2.assert();
        assert!(result.is_ok());
        Ok(())
    }
}
