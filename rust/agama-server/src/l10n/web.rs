// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

//! This module implements the web API for the localization module.

use super::{
    error::LocaleError,
    model::{keyboard::Keymap, locale::LocaleEntry, timezone::TimezoneEntry, L10n},
};
use crate::{
    error::Error,
    web::{Event, EventsSender},
};
use agama_lib::{
    error::ServiceError, localization::model::LocaleConfig, localization::LocaleProxy,
    proxies::LocaleMixinProxy as ManagerLocaleProxy,
};
use agama_locale_data::LocaleId;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, patch},
    Json, Router,
};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Clone)]
struct LocaleState<'a> {
    locale: Arc<RwLock<L10n>>,
    proxy: LocaleProxy<'a>,
    manager_proxy: ManagerLocaleProxy<'a>,
    events: EventsSender,
}

/// Sets up and returns the axum service for the localization module.
///
/// * `events`: channel to send the events to the main service.
pub async fn l10n_service(
    dbus: zbus::Connection,
    events: EventsSender,
) -> Result<Router, ServiceError> {
    let id = LocaleId::default();
    let locale = L10n::new_with_locale(&id).unwrap();
    let proxy = LocaleProxy::new(&dbus).await?;
    let manager_proxy = ManagerLocaleProxy::new(&dbus).await?;
    let state = LocaleState {
        locale: Arc::new(RwLock::new(locale)),
        proxy,
        manager_proxy,
        events,
    };

    let router = Router::new()
        .route("/keymaps", get(keymaps))
        .route("/locales", get(locales))
        .route("/timezones", get(timezones))
        .route("/config", patch(set_config).get(get_config))
        .with_state(state);
    Ok(router)
}

#[utoipa::path(
    get,
    path = "/locales",
    context_path = "/api/l10n",
    responses(
      (status = 200, description = "List of known locales", body = Vec<LocaleEntry>)
    )
)]
async fn locales(State(state): State<LocaleState<'_>>) -> Json<Vec<LocaleEntry>> {
    let data = state.locale.read().await;
    let locales = data.locales_db.entries().to_vec();
    Json(locales)
}

#[utoipa::path(
    get,
    path = "/timezones",
    context_path = "/api/l10n",
    responses(
      (status = 200, description = "List of known timezones", body = Vec<TimezoneEntry>)
  )
)]
async fn timezones(State(state): State<LocaleState<'_>>) -> Json<Vec<TimezoneEntry>> {
    let data = state.locale.read().await;
    let timezones = data.timezones_db.entries().to_vec();
    Json(timezones)
}

#[utoipa::path(
    get,
    path = "/keymaps",
    context_path = "/api/l10n",
    responses(
      (status = 200, description = "List of known keymaps", body = Vec<Keymap>)
    )
)]
async fn keymaps(State(state): State<LocaleState<'_>>) -> Json<Vec<Keymap>> {
    let data = state.locale.read().await;
    let keymaps = data.keymaps_db.entries().to_vec();
    Json(keymaps)
}

// TODO: update all or nothing
// TODO: send only the attributes that have changed
#[utoipa::path(
    patch,
    path = "/config",
    context_path = "/api/l10n",
    operation_id = "set_l10n_config",
    responses(
      (status = 204, description = "Set the locale configuration", body = LocaleConfig)
    )
)]
async fn set_config(
    State(state): State<LocaleState<'_>>,
    Json(value): Json<LocaleConfig>,
) -> Result<impl IntoResponse, Error> {
    let mut data = state.locale.write().await;
    let mut changes = LocaleConfig::default();

    if let Some(locales) = &value.locales {
        data.set_locales(locales)?;
        changes.locales.clone_from(&value.locales);
    }

    if let Some(timezone) = &value.timezone {
        data.set_timezone(timezone)?;
        changes.timezone.clone_from(&value.timezone);
    }

    if let Some(keymap_id) = &value.keymap {
        let keymap_id = keymap_id.parse().map_err(LocaleError::InvalidKeymap)?;
        data.set_keymap(keymap_id)?;
        changes.keymap.clone_from(&value.keymap);
    }

    if let Some(ui_locale) = &value.ui_locale {
        let locale = ui_locale
            .as_str()
            .try_into()
            .map_err(LocaleError::InvalidLocale)?;
        data.translate(&locale)?;
        let locale_string = locale.to_string();
        state.manager_proxy.set_locale(&locale_string).await?;
        changes.ui_locale = Some(locale_string);

        _ = state.events.send(Event::LocaleChanged {
            locale: locale.to_string(),
        });
    }

    if let Some(ui_keymap) = &value.ui_keymap {
        let ui_keymap = ui_keymap.parse().map_err(LocaleError::InvalidKeymap)?;
        data.set_ui_keymap(ui_keymap)?;
    }

    if let Err(e) = update_dbus(&state.proxy, &changes).await {
        log::warn!("Could not synchronize settings in the localization D-Bus service: {e}");
    }
    _ = state.events.send(Event::L10nConfigChanged(changes));

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/l10n",
    operation_id = "get_l10n_config",
    responses(
        (status = 200, description = "Localization configuration", body = LocaleConfig)
    )
)]
async fn get_config(State(state): State<LocaleState<'_>>) -> Json<LocaleConfig> {
    let data = state.locale.read().await;
    let locales = data.locales.iter().map(ToString::to_string).collect();
    Json(LocaleConfig {
        locales: Some(locales),
        keymap: Some(data.keymap.to_string()),
        timezone: Some(data.timezone.to_string()),
        ui_locale: Some(data.ui_locale.to_string()),
        ui_keymap: Some(data.ui_keymap.to_string()),
    })
}

pub async fn update_dbus(
    client: &LocaleProxy<'_>,
    config: &LocaleConfig,
) -> Result<(), ServiceError> {
    if let Some(locales) = &config.locales {
        let locales: Vec<_> = locales.iter().map(|l| l.as_ref()).collect();
        client.set_locales(&locales).await?;
    }

    if let Some(keymap) = &config.keymap {
        client.set_keymap(keymap.as_str()).await?;
    }

    if let Some(timezone) = &config.timezone {
        client.set_timezone(timezone).await?;
    }

    if let Some(ui_locale) = &config.ui_locale {
        client.set_uilocale(ui_locale).await?;
    }

    Ok(())
}
