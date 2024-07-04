use anyhow::anyhow; // WIP

use serde::Deserialize;
//use reqwest::StatusCode;
use super::client::FirstUser;
use crate::{base_http_client::BaseHTTPClient, error::ServiceError};

pub struct UsersHttpClient {
    client: BaseHTTPClient,
}

// copying agama_server::users::web::RootConfig
// but not all derives
// #[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[derive(Clone, Debug, Default, Deserialize)]
pub struct RootConfig {
    /// returns if password for root is set or not
    password: bool,
    /// empty string mean no sshkey is specified
    sshkey: String,
}

impl UsersHttpClient {
    pub async fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: BaseHTTPClient::new()?,
        })
    }

    /// Returns the settings for first non admin user
    pub async fn first_user(&self) -> Result<FirstUser, ServiceError> {
        self.client.get("/users/first").await
    }


    /// Set the configuration for the first user
    pub async fn set_first_user(
        &self,
        first_user: &FirstUser,
    ) -> Result<(bool, Vec<String>), ServiceError> {
        /*
        self.users_proxy
            .set_first_user(
                &first_user.full_name,
                &first_user.user_name,
                &first_user.password,
                first_user.autologin,
                std::collections::HashMap::new(),
            )
            .await
            */
        //Err(anyhow!("TODO implement UsersHttpClient SETUSER").into())
        self.client.put("/users/first", first_user).await?;
        // TODO: make BaseHTTPClient.put(_response) return the issues
        Ok((true, vec!()))
    }

    pub async fn remove_first_user(&self) -> Result<bool, ServiceError> {
        //Ok(self.users_proxy.remove_first_user().await? == 0)
        Err(anyhow!("TODO implement UsersHttpClient RMUSER").into())
    }

    async fn root_config(&self) -> Result<RootConfig, ServiceError> {
        self.client.get("/users/root").await
    }

    /// Whether the root password is set or not
    pub async fn is_root_password(&self) -> Result<bool, ServiceError> {
        let root_config = self.root_config().await?;
        Ok(root_config.password)
    }

    /// SetRootPassword method
    pub async fn set_root_password(
        &self,
        _value: &str,
        _encrypted: bool,
    ) -> Result<u32, ServiceError> {
        //Ok(self.users_proxy.set_root_password(value, encrypted).await?)
        Err(anyhow!("TODO implement UsersHttpClient SETPASS").into())
    }

    pub async fn remove_root_password(&self) -> Result<u32, ServiceError> {
        //Ok(self.users_proxy.remove_root_password().await?)
        Err(anyhow!("TODO implement UsersHttpClient RMPASS").into())
    }

    /// Returns the SSH key for the root user
    pub async fn root_ssh_key(&self) -> Result<String, ServiceError> {
        let root_config = self.root_config().await?;
        Ok(root_config.sshkey)
    }

    
    /// SetRootSSHKey method
    pub async fn set_root_sshkey(&self, value: &str) -> Result<u32, ServiceError> {
        //Ok(self.users_proxy.set_root_sshkey(value).await?)
        Err(anyhow!("TODO implement UsersHttpClient SETKEY {}", value).into())
    }
}
