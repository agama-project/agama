use super::client::FirstUser;
use crate::users::model::{RootConfig, RootPatchSettings};
use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

pub struct UsersHTTPClient {
    client: BaseHTTPClient,
}

impl UsersHTTPClient {
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    pub fn new_with_base(client: BaseHTTPClient) -> Result<Self, ServiceError> {
        Ok(Self { client })
    }

    /// Returns the settings for first non admin user
    pub async fn first_user(&self) -> Result<FirstUser, ServiceError> {
        self.client.get("/users/first").await
    }

    /// Set the configuration for the first user
    pub async fn set_first_user(&self, first_user: &FirstUser) -> Result<(), ServiceError> {
        let result = self.client.put_void("/users/first", first_user).await;
        if let Err(ServiceError::BackendError(422, ref issues_s)) = result {
            let issues: Vec<String> = serde_json::from_str(issues_s)?;
            return Err(ServiceError::WrongUser(issues));
        }
        result
    }

    async fn root_config(&self) -> Result<RootConfig, ServiceError> {
        self.client.get("/users/root").await
    }

    /// Whether the root password is set or not
    pub async fn is_root_password(&self) -> Result<bool, ServiceError> {
        let root_config = self.root_config().await?;
        Ok(root_config.password)
    }

    /// SetRootPassword method.
    /// Returns 0 if successful (always, for current backend)
    pub async fn set_root_password(
        &self,
        value: &str,
        encrypted: bool,
    ) -> Result<u32, ServiceError> {
        let rps = RootPatchSettings {
            sshkey: None,
            password: Some(value.to_owned()),
            password_encrypted: Some(encrypted),
        };
        let ret = self.client.patch("/users/root", &rps).await?;
        Ok(ret)
    }

    /// Returns the SSH key for the root user
    pub async fn root_ssh_key(&self) -> Result<String, ServiceError> {
        let root_config = self.root_config().await?;
        Ok(root_config.sshkey)
    }

    /// SetRootSSHKey method.
    /// Returns 0 if successful (always, for current backend)
    pub async fn set_root_sshkey(&self, value: &str) -> Result<u32, ServiceError> {
        let rps = RootPatchSettings {
            sshkey: Some(value.to_owned()),
            password: None,
            password_encrypted: None,
        };
        let ret = self.client.patch("/users/root", &rps).await?;
        Ok(ret)
    }
}
