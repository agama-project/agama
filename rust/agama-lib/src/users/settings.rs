use serde::{Deserialize, Serialize};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(rename = "user")]
    pub first_user: Option<FirstUserSettings>,
    pub root: Option<RootUserSettings>,
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FirstUserSettings {
    /// First user's full name
    pub full_name: Option<String>,
    /// First user's username
    pub user_name: Option<String>,
    /// First user's password (in clear text)
    pub password: Option<String>,
    /// Whether auto-login should enabled or not
    pub autologin: Option<bool>,
}

/// Root user settings
///
/// Holds the settings for the root user.
#[derive(Debug, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RootUserSettings {
    /// Root's password (in clear text)
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// Root SSH public key
    pub ssh_public_key: Option<String>,
}
