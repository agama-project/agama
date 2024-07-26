use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootConfig {
    /// returns if password for root is set or not
    pub password: bool,
    /// empty string mean no sshkey is specified
    pub sshkey: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RootPatchSettings {
    /// empty string here means remove ssh key for root
    pub sshkey: Option<String>,
    /// empty string here means remove password for root
    pub password: Option<String>,
    /// specify if patched password is provided in encrypted form
    pub password_encrypted: Option<bool>,
}
