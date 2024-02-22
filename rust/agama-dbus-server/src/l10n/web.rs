//! This module implements the web API for the localization module.

use super::{keyboard::Keymap, locale::LocaleEntry, timezone::TimezoneEntry, Locale};
use crate::error::Error;
use crate::l10n::helpers;
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

// Locale service state.
type LocaleState = Arc<RwLock<Locale>>;

/// Sets up and returns the axum service for the localization module.
pub fn l10n_service() -> Router {
    let code = LocaleCode::default();
    let locale = Locale::new_with_locale(&code).unwrap();
    let state = Arc::new(RwLock::new(locale));
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
pub async fn locales(State(state): State<LocaleState>) -> Json<LocalesResponse> {
    let data = state.read().expect("could not access to locale data");
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
pub async fn timezones(State(state): State<LocaleState>) -> Json<TimezonesResponse> {
    let data = state.read().expect("could not access to locale data");
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
pub async fn keymaps(State(state): State<LocaleState>) -> Json<KeymapsResponse> {
    let data = state.read().expect("could not access to locale data");
    let keymaps = data.keymaps_db.entries().to_vec();
    Json(KeymapsResponse { keymaps })
}

async fn set_config(
    State(state): State<LocaleState>,
    Json(value): Json<LocaleConfig>,
) -> Result<Json<()>, LocaleError> {
    let mut data = state.write().unwrap();

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
    }

    Ok(Json(()))
}

async fn get_config(State(state): State<LocaleState>) -> Json<LocaleConfig> {
    let data = state.read().unwrap();
    Json(LocaleConfig {
        locales: Some(data.locales.clone()),
        keymap: Some(data.keymap()),
        timezone: Some(data.timezone().to_string()),
        ui_locale: Some(data.ui_locale().to_string()),
    })
}
