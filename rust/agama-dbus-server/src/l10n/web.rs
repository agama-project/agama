//! This module implements the web API for the localization module.

use super::{keyboard::Keymap, locale::LocaleEntry, timezone::TimezoneEntry, Locale};
use crate::{
    error::Error,
    l10n::helpers,
    web::{Event, EventsSender},
};
use agama_locale_data::{InvalidKeymap, LocaleCode};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::{Arc, RwLock};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LocaleError {
    #[error("Unknown locale code: {0}")]
    UnknownLocale(String),
    #[error("Unknown timezone: {0}")]
    UnknownTimezone(String),
    #[error("Invalid keymap: {0}")]
    InvalidKeymap(#[from] InvalidKeymap),
    #[error("Cannot translate: {0}")]
    CannotTranslate(#[from] Error),
}

impl IntoResponse for LocaleError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[derive(Clone)]
struct LocaleState {
    locale: Arc<RwLock<Locale>>,
    events: EventsSender,
}

/// Sets up and returns the axum service for the localization module.
///
/// * `events`: channel to send the events to the main service.
pub fn l10n_service(events: EventsSender) -> Router {
    let code = LocaleCode::default();
    let locale = Locale::new_with_locale(&code).unwrap();
    let state = LocaleState {
        locale: Arc::new(RwLock::new(locale)),
        events,
    };

    Router::new()
        .route("/keymaps", get(keymaps))
        .route("/locales", get(locales))
        .route("/timezones", get(timezones))
        .route("/config", put(set_config).get(get_config))
        .with_state(state)
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct LocalesResponse {
    locales: Vec<LocaleEntry>,
}

#[utoipa::path(get, path = "/locales", responses(
  (status = 200, description = "List of known locales", body = LocalesResponse)
))]
async fn locales(State(state): State<LocaleState>) -> Json<LocalesResponse> {
    let data = state
        .locale
        .read()
        .expect("could not access to locale data");
    let locales = data.locales_db.entries().to_vec();
    Json(LocalesResponse { locales })
}

#[derive(Serialize, Deserialize)]
struct LocaleConfig {
    locales: Option<Vec<String>>,
    keymap: Option<String>,
    timezone: Option<String>,
    ui_locale: Option<String>,
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct TimezonesResponse {
    timezones: Vec<TimezoneEntry>,
}

#[utoipa::path(get, path = "/timezones", responses(
    (status = 200, description = "List of known timezones", body = TimezonesResponse)
))]
async fn timezones(State(state): State<LocaleState>) -> Json<TimezonesResponse> {
    let data = state
        .locale
        .read()
        .expect("could not access to locale data");
    let timezones = data.timezones_db.entries().to_vec();
    Json(TimezonesResponse { timezones })
}

#[derive(Debug, Serialize, utoipa::ToSchema)]
pub struct KeymapsResponse {
    keymaps: Vec<Keymap>,
}

#[utoipa::path(get, path = "/keymaps", responses(
    (status = 200, description = "List of known keymaps", body = KeymapsResponse)
))]
async fn keymaps(State(state): State<LocaleState>) -> Json<KeymapsResponse> {
    let data = state
        .locale
        .read()
        .expect("could not access to locale data");
    let keymaps = data.keymaps_db.entries().to_vec();
    Json(KeymapsResponse { keymaps })
}

async fn set_config(
    State(state): State<LocaleState>,
    Json(value): Json<LocaleConfig>,
) -> Result<Json<()>, LocaleError> {
    let mut data = state.locale.write().unwrap();

    if let Some(locales) = &value.locales {
        for loc in locales {
            if !data.locales_db.exists(loc.as_str()) {
                return Err(LocaleError::UnknownLocale(loc.to_string()));
            }
        }
        data.locales = locales.clone();
    }

    if let Some(timezone) = &value.timezone {
        if !data.timezones_db.exists(timezone) {
            return Err(LocaleError::UnknownTimezone(timezone.to_string()));
        }
        data.timezone = timezone.to_owned();
    }

    if let Some(keymap_id) = &value.keymap {
        data.keymap = keymap_id.parse()?;
    }

    if let Some(ui_locale) = &value.ui_locale {
        let locale: LocaleCode = ui_locale
            .as_str()
            .try_into()
            .map_err(|_e| LocaleError::UnknownLocale(ui_locale.to_string()))?;

        helpers::set_service_locale(&locale);
        data.translate(&locale)?;
        _ = state.events.send(Event::LocaleChanged {
            locale: locale.to_string(),
        });
    }

    Ok(Json(()))
}

async fn get_config(State(state): State<LocaleState>) -> Json<LocaleConfig> {
    let data = state.locale.read().unwrap();
    Json(LocaleConfig {
        locales: Some(data.locales.clone()),
        keymap: Some(data.keymap()),
        timezone: Some(data.timezone().to_string()),
        ui_locale: Some(data.ui_locale().to_string()),
    })
}

#[cfg(test)]
mod tests {
    use crate::l10n::{web::LocaleState, Locale};
    use agama_locale_data::{KeymapId, LocaleCode};
    use std::sync::{Arc, RwLock};
    use tokio::{sync::broadcast::channel, test};

    fn build_state() -> LocaleState {
        let (tx, _) = channel(16);
        let default_code = LocaleCode::default();
        let locale = Locale::new_with_locale(&default_code).unwrap();
        LocaleState {
            locale: Arc::new(RwLock::new(locale)),
            events: tx,
        }
    }

    #[test]
    async fn test_locales() {
        let state = build_state();
        let response = super::locales(axum::extract::State(state)).await;
        let default = LocaleCode::default();
        let found = response.locales.iter().find(|l| l.code == default);
        assert!(found.is_some());
    }

    #[test]
    async fn test_keymaps() {
        let state = build_state();
        let response = super::keymaps(axum::extract::State(state)).await;
        let english: KeymapId = "us".parse().unwrap();
        let found = response.keymaps.iter().find(|k| k.id == english);
        assert!(found.is_some());
    }

    #[test]
    async fn test_timezones() {
        let state = build_state();
        let response = super::timezones(axum::extract::State(state)).await;
        let found = response
            .timezones
            .iter()
            .find(|t| t.code == "Atlantic/Canary");
        assert!(found.is_some());
    }
}
