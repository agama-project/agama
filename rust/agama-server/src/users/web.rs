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

//!
//! The module offers two public functions:
//!
//! * `users_service` which returns the Axum service.
//! * `users_stream` which offers an stream that emits the users events coming from D-Bus.

use crate::{
    error::Error,
    users::password::PasswordChecker,
    web::common::{service_status_router, EventStreams, IssuesClient, IssuesRouterBuilder},
};
use agama_lib::{
    error::ServiceError,
    event,
    http::Event,
    users::{model::RootPatchSettings, proxies::Users1Proxy, FirstUser, RootUser, UsersClient},
};
use anyhow::Context;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use tokio_stream::{Stream, StreamExt};

use super::password::PasswordCheckResult;

#[derive(Clone)]
struct UsersState<'a> {
    users: UsersClient<'a>,
}

/// Returns streams that emits users related events coming from D-Bus.
///
/// It emits the RootPasswordChange, RootSSHKeyChanged and FirstUserChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn users_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    const FIRST_USER_ID: &str = "first_user";
    const ROOT_USER_ID: &str = "root_user";
    let result: EventStreams = vec![
        (
            FIRST_USER_ID,
            Box::pin(first_user_changed_stream(dbus.clone()).await?),
        ),
        (
            ROOT_USER_ID,
            Box::pin(root_user_changed_stream(dbus.clone()).await?),
        ),
    ];

    Ok(result)
}

async fn first_user_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_first_user_changed()
        .await
        .then(|change| async move {
            if let Ok(user) = change.get().await {
                let user_struct = FirstUser {
                    full_name: user.0,
                    user_name: user.1,
                    password: user.2,
                    hashed_password: user.3,
                };
                return Some(event!(FirstUserChanged(user_struct)));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn root_user_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_root_user_changed()
        .await
        .then(|change| async move {
            if let Ok(user) = change.get().await {
                if let Ok(root) = RootUser::from_dbus(user) {
                    return Some(event!(RootUserChanged(root)));
                }
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

/// Sets up and returns the axum service for the users module.
pub async fn users_service(
    dbus: zbus::Connection,
    issues: IssuesClient,
) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Manager1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Users1";

    let users = UsersClient::new(dbus.clone()).await?;
    let state = UsersState { users };
    // FIXME: use anyhow temporarily until we adapt all these methods to return
    // the crate::error::Error instead of ServiceError.
    let issues_router = IssuesRouterBuilder::new(DBUS_SERVICE, DBUS_PATH, issues.clone())
        .build()
        .context("Could not build an issues router")?;
    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let router = Router::new()
        .route(
            "/first",
            get(get_user_config)
                .put(set_first_user)
                .delete(remove_first_user),
        )
        .route("/root", get(get_root_config).patch(patch_root))
        .route("/password_check", post(check_password))
        .merge(status_router)
        .nest("/issues", issues_router)
        .with_state(state);
    Ok(router)
}

/// Removes the first user settings
#[utoipa::path(
    delete,
    path = "/first",
    context_path = "/api/users",
    responses(
        (status = 200, description = "Removes the first user"),
        (status = 400, description = "The D-Bus service could not perform the action"),
    )
)]
async fn remove_first_user(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_first_user().await?;
    Ok(())
}

#[utoipa::path(
    put,
    path = "/first",
    context_path = "/api/users",
    responses(
        (status = 200, description = "Sets the first user"),
        (status = 400, description = "The D-Bus service could not perform the action"),
        (status = 422, description = "Invalid first user. Details are in body", body = Vec<String>),
    )
)]
async fn set_first_user(
    State(state): State<UsersState<'_>>,
    Json(config): Json<FirstUser>,
) -> Result<impl IntoResponse, Error> {
    // issues: for example, trying to use a system user id; empty password
    // success: simply issues.is_empty()
    let (_success, issues) = state.users.set_first_user(&config).await?;
    let status = if issues.is_empty() {
        StatusCode::OK
    } else {
        StatusCode::UNPROCESSABLE_ENTITY
    };

    Ok((status, Json(issues).into_response()))
}

#[utoipa::path(
    get,
    path = "/first",
    context_path = "/api/users",
    responses(
        (status = 200, description = "Configuration for the first user", body = FirstUser),
        (status = 400, description = "The D-Bus service could not perform the action"),
    )
)]
async fn get_user_config(State(state): State<UsersState<'_>>) -> Result<Json<FirstUser>, Error> {
    Ok(Json(state.users.first_user().await?))
}

#[utoipa::path(
    patch,
    path = "/root",
    context_path = "/api/users",
    responses(
        (status = 200, description = "Root configuration is modified", body = RootPatchSettings),
        (status = 400, description = "The D-Bus service could not perform the action"),
    )
)]
async fn patch_root(
    State(state): State<UsersState<'_>>,
    Json(config): Json<RootPatchSettings>,
) -> Result<impl IntoResponse, Error> {
    let mut retcode1 = 0;
    if let Some(key) = config.ssh_public_key {
        retcode1 = state.users.set_root_sshkey(&key).await?;
    }

    let mut retcode2 = 0;
    if let Some(password) = config.password {
        retcode2 = if password.is_empty() {
            state.users.remove_root_password().await?
        } else {
            state
                .users
                .set_root_password(&password, config.hashed_password == Some(true))
                .await?
        }
    }

    let retcode: u32 = if retcode1 != 0 { retcode1 } else { retcode2 };

    Ok(Json(retcode))
}

#[utoipa::path(
    get,
    path = "/root",
    context_path = "/api/users",
    responses(
        (status = 200, description = "Configuration for the root user", body = RootUser),
        (status = 400, description = "The D-Bus service could not perform the action"),
    )
)]
async fn get_root_config(State(state): State<UsersState<'_>>) -> Result<Json<RootUser>, Error> {
    Ok(Json(state.users.root_user().await?))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct PasswordParams {
    password: String,
}

#[utoipa::path(
    post,
    path = "/password_check",
    context_path = "/api/users",
    description = "Performs a quality check on a given password",
    responses(
        (status = 200, description = "The password was checked", body = String),
        (status = 400, description = "Could not check the password")
    )
)]
async fn check_password(
    Json(password): Json<PasswordParams>,
) -> Result<Json<PasswordCheckResult>, Error> {
    let checker = PasswordChecker::default();
    let result = checker.check(&password.password);
    Ok(Json(result?))
}
