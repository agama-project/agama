//! Implements the store for the localization settings.
// TODO: for an overview see crate::store (?)

use super::{LocalizationHTTPClient, LocalizationSettings};
use crate::error::ServiceError;
use crate::localization::model::LocaleConfig;

/// Loads and stores the storage settings from/to the D-Bus service.
pub struct LocalizationStore {
    localization_client: LocalizationHTTPClient,
}

impl LocalizationStore {
    pub async fn new() -> Result<LocalizationStore, ServiceError> {
        Ok(Self {
            localization_client: LocalizationHTTPClient::new().await?,
        })
    }

    pub async fn new_with_client(
        client: LocalizationHTTPClient,
    ) -> Result<LocalizationStore, ServiceError> {
        Ok(Self {
            localization_client: client,
        })
    }

    /// Consume *v* and return its first element, or None.
    /// This is similar to VecDeque::pop_front but it consumes the whole Vec.
    fn chestburster(mut v: Vec<String>) -> Option<String> {
        if v.is_empty() {
            None
        } else {
            Some(v.swap_remove(0))
        }
    }

    pub async fn load(&self) -> Result<LocalizationSettings, ServiceError> {
        let config = self.localization_client.get_config().await?;

        let opt_language = config
            .locales
            .map(|vec_s| Self::chestburster(vec_s))
            .flatten();
        let opt_keyboard = config.keymap;
        let opt_timezone = config.timezone;

        Ok(LocalizationSettings {
            language: opt_language,
            keyboard: opt_keyboard,
            timezone: opt_timezone,
        })
    }

    pub async fn store(&self, settings: &LocalizationSettings) -> Result<(), ServiceError> {
        // clones are necessary as we have different structs owning their data
        let opt_language = settings.language.clone();
        let opt_keymap = settings.keyboard.clone();
        let opt_timezone = settings.timezone.clone();

        let config = LocaleConfig {
            locales: opt_language.map(|s| vec![s]),
            keymap: opt_keymap,
            timezone: opt_timezone,
            ui_locale: None,
            ui_keymap: None,
        };
        self.localization_client.set_config(&config).await
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use crate::base_http_client::BaseHTTPClient;
    use httpmock::prelude::*;
    use std::error::Error;
    use tokio::test; // without this, "error: async functions cannot be used for tests"

    #[test]
    async fn test_getting_l10n() -> Result<(), Box<dyn Error>> {
        let server = MockServer::start();
        let l10n_mock = server.mock(|when, then| {
            when.method(GET).path("/api/l10n/config");
            then.status(200)
                .header("content-type", "application/json")
                .body(
                    r#"{
                    "locales": ["fr_FR.UTF-8"],
                    "keymap": "fr(dvorak)",
                    "timezone": "Europe/Paris"
                }"#,
                );
        });
        let url = server.url("/api");

        let bhc = BaseHTTPClient {
            base_url: url,
            ..Default::default()
        };
        let client = LocalizationHTTPClient::new_with_base(bhc).await?;
        let store = LocalizationStore::new_with_client(client).await?;

        let settings = store.load().await?;

        // Ensure the specified mock was called exactly one time (or fail with a detailed error description).
        l10n_mock.assert();

        let expected = LocalizationSettings {
            language: Some("fr_FR.UTF-8".to_owned()),
            keyboard: Some("fr(dvorak)".to_owned()),
            timezone: Some("Europe/Paris".to_owned()),
        };
        assert_eq!(settings, expected);
        Ok(())
    }
}
