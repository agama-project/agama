use super::{FirstUser, FirstUserSettings, RootUserSettings, UserSettings, UsersHttpClient};
use crate::error::ServiceError;
use reqwest;

/// Loads and stores the users settings from/to the D-Bus service.
pub struct UsersStore {
    users_client: UsersHttpClient,
}

impl UsersStore {
    pub async fn new(_client: reqwest::Client) -> Result<Self, ServiceError> {
        Ok(Self {
            users_client: UsersHttpClient::new().await?,
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
        let (success, issues) = self.users_client.set_first_user(&first_user).await?;
        if !success {
            return Err(ServiceError::WrongUser(issues));
        }
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
