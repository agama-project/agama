use agama_settings::Settings;
use serde::{Deserialize, Serialize};

/// User settings
///
/// Holds the user settings for the installation.
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    #[serde(rename = "user")]
    #[settings(nested, alias = "user")]
    pub first_user: Option<FirstUserSettings>,
    #[settings(nested)]
    pub root: Option<RootUserSettings>,
}

/// First user settings
///
/// Holds the settings for the first user.
#[derive(Clone, Debug, Default, Settings, Serialize, Deserialize, utoipa::ToSchema)]
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
#[derive(Debug, Default, Settings, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RootUserSettings {
    /// Root's password (in clear text)
    #[serde(skip_serializing)]
    pub password: Option<String>,
    /// Root SSH public key
    pub ssh_public_key: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use agama_settings::settings::Settings;

    #[test]
    fn test_user_settings_merge() {
        let mut user1 = UserSettings::default();
        let user2 = UserSettings {
            first_user: Some(FirstUserSettings {
                full_name: Some("Jane Doe".to_string()),
                ..Default::default()
            }),
            root: Some(RootUserSettings {
                password: Some("nots3cr3t".to_string()),
                ..Default::default()
            }),
        };
        user1.merge(&user2);
        let first_user = user1.first_user.unwrap();
        assert_eq!(first_user.full_name, Some("Jane Doe".to_string()));
        let root_user = user1.root.unwrap();
        assert_eq!(root_user.password, Some("nots3cr3t".to_string()));
    }

    #[test]
    fn test_merge() {
        let mut user1 = FirstUserSettings::default();
        let user2 = FirstUserSettings {
            full_name: Some("Jane Doe".to_owned()),
            autologin: Some(true),
            ..Default::default()
        };
        user1.merge(&user2);
        assert_eq!(user1.full_name.unwrap(), "Jane Doe")
    }
}
