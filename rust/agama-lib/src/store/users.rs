use crate::install_settings::{FirstUserSettings, RootUserSettings, UserSettings};
use crate::users::{FirstUser, UsersClient};
use crate::error::WrongParameter;
use std::error::Error;
use zbus::Connection;

/// Loads and stores the users settings from/to the D-Bus service.
pub struct UsersStore<'a> {
    users_client: UsersClient<'a>,
}

impl<'a> UsersStore<'a> {
    pub async fn new(connection: Connection) -> Result<UsersStore<'a>, zbus::Error> {
        Ok(Self {
            users_client: UsersClient::new(connection).await?,
        })
    }

    pub async fn load(&self) -> Result<UserSettings, Box<dyn Error>> {
        let first_user = self.users_client.first_user().await?;
        let first_user = FirstUserSettings {
            user_name: Some(first_user.user_name),
            autologin: Some(first_user.autologin),
            full_name: Some(first_user.full_name),
            password: Some(first_user.password),
        };
        let ssh_public_key = self.users_client.root_ssh_key().await;
        let root_user = RootUserSettings {
            // todo: expose the password
            password: None,
            ssh_public_key: ssh_public_key.ok(),
        };
        Ok(UserSettings {
            first_user: Some(first_user),
            root: Some(root_user),
        })
    }

    pub async fn store(&self, settings: &UserSettings) -> Result<(), Box<dyn Error>> {
        // fixme: improve
        if let Some(settings) = &settings.first_user {
            self.store_first_user(settings).await?;
        }

        if let Some(settings) = &settings.root {
            self.store_root_user(settings).await?;
        }
        Ok(())
    }

    async fn store_first_user(&self, settings: &FirstUserSettings) -> Result<(), Box<dyn Error>> {
        let first_user = FirstUser {
            user_name: settings.user_name.clone().unwrap_or_default(),
            full_name: settings.full_name.clone().unwrap_or_default(),
            autologin: settings.autologin.unwrap_or_default(),
            password: settings.password.clone().unwrap_or_default(),
            ..Default::default()
        };
        let (success, issues) = self.users_client.set_first_user(&first_user).await?;
        if !success {
            return Err(Box::new(WrongParameter::WrongUser(issues)));  
        }
        Ok(())
    }

    async fn store_root_user(&self, settings: &RootUserSettings) -> Result<(), Box<dyn Error>> {
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
