//! Implements a client to access Agama's users service.

use super::proxies::{FirstUser as FirstUserFromDBus, Users1Proxy};
use crate::error::ServiceError;
use agama_settings::{settings::Settings, SettingValue, SettingsError};
use serde::Serialize;
use zbus::Connection;

/// Represents the settings for the first user
#[derive(Serialize, Debug, Default)]
pub struct FirstUser {
    /// First user's full name
    pub full_name: String,
    /// First user's username
    pub user_name: String,
    /// First user's password (in clear text)
    pub password: String,
    /// Whether auto-login should enabled or not
    pub autologin: bool,
    /// Additional data coming from the D-Bus service
    pub data: std::collections::HashMap<String, zbus::zvariant::OwnedValue>,
}

impl FirstUser {
    pub fn from_dbus(dbus_data: zbus::Result<FirstUserFromDBus>) -> zbus::Result<Self> {
        let data = dbus_data?;
        Ok(Self {
            full_name: data.0,
            user_name: data.1,
            password: data.2,
            autologin: data.3,
            data: data.4,
        })
    }
}

// TODO: use the Settings macro (add support for ignoring fields to the macro and use Option for
// FirstUser fields)
impl Settings for FirstUser {
    fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), SettingsError> {
        match attr {
            "full_name" => {
                self.full_name = value
                    .try_into()
                    .map_err(|e| SettingsError::UpdateFailed(attr.to_string(), e))?
            }
            "user_name" => {
                self.user_name = value
                    .try_into()
                    .map_err(|e| SettingsError::UpdateFailed(attr.to_string(), e))?
            }
            "password" => {
                self.full_name = value
                    .try_into()
                    .map_err(|e| SettingsError::UpdateFailed(attr.to_string(), e))?
            }
            "autologin" => {
                self.full_name = value
                    .try_into()
                    .map_err(|e| SettingsError::UpdateFailed(attr.to_string(), e))?
            }
            _ => return Err(SettingsError::UnknownAttribute(attr.to_string())),
        }
        Ok(())
    }
}

/// D-Bus client for the users service
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

    /// SetRootPassword method
    pub async fn set_root_password(
        &self,
        value: &str,
        encrypted: bool,
    ) -> Result<u32, ServiceError> {
        Ok(self.users_proxy.set_root_password(value, encrypted).await?)
    }

    /// Whether the root password is set or not
    pub async fn is_root_password(&self) -> Result<bool, ServiceError> {
        Ok(self.users_proxy.root_password_set().await?)
    }

    /// Returns the SSH key for the root user
    pub async fn root_ssh_key(&self) -> zbus::Result<String> {
        self.users_proxy.root_sshkey().await
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
                first_user.autologin,
                std::collections::HashMap::new(),
            )
            .await
    }
}
