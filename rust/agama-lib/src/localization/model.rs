use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LocaleConfig {
    /// Locales to install in the target system
    pub locales: Option<Vec<String>>,
    /// Keymap for the target system
    pub keymap: Option<String>,
    /// Timezone for the target system
    pub timezone: Option<String>,
    /// User-interface locale. It is actually not related to the `locales` property.
    pub ui_locale: Option<String>,
    /// User-interface locale. It is relevant only on local installations.
    pub ui_keymap: Option<String>,
}
