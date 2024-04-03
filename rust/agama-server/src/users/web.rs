//!
//! The module offers two public functions:
//!
//! * `users_service` which returns the Axum service.
//! * `users_stream` which offers an stream that emits the users events coming from D-Bus.

use crate::{
    error::Error,
    web::{
        common::{service_status_router, validation_router},
        Event,
    },
};
use agama_lib::{
    error::ServiceError,
    users::{proxies::Users1Proxy, FirstUser, UsersClient},
};
use axum::{
    extract::State,
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use tokio_stream::{Stream, StreamExt};

#[derive(Clone)]
struct UsersState<'a> {
    users: UsersClient<'a>,
}

/// Returns streams that emits users related events coming from D-Bus.
///
/// It emits the Event::RootPasswordChange, Event::RootSSHKeyChanged and Event::FirstUserChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn users_streams(
    dbus: zbus::Connection,
) -> Result<Vec<(&'static str, Pin<Box<dyn Stream<Item = Event> + Send>>)>, Error> {
    const FIRST_USER_ID: &str = "first_user";
    const ROOT_PASSWORD_ID: &str = "root_password";
    const ROOT_SSHKEY_ID: &str = "root_sshkey";
    let result: Vec<(&str, Pin<Box<dyn Stream<Item = Event> + Send>>)> = vec![
        (
            FIRST_USER_ID,
            Box::pin(first_user_changed_stream(dbus.clone()).await?),
        ),
        (
            ROOT_PASSWORD_ID,
            Box::pin(root_password_changed_stream(dbus.clone()).await?),
        ),
        (
            ROOT_SSHKEY_ID,
            Box::pin(root_ssh_key_changed_stream(dbus.clone()).await?),
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
                    autologin: user.3,
                    data: user.4,
                };
                return Some(Event::FirstUserChanged(user_struct));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn root_password_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_root_password_set_changed()
        .await
        .then(|change| async move {
            if let Ok(is_set) = change.get().await {
                return Some(Event::RootPasswordChanged {
                    password_is_set: is_set,
                });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn root_ssh_key_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_root_sshkey_changed()
        .await
        .then(|change| async move {
            if let Ok(key) = change.get().await {
                let value = if key.is_empty() { None } else { Some(key) };
                return Some(Event::RootSSHKeyChanged { key: value });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

/// Sets up and returns the axum service for the software module.
pub async fn users_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Manager1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Users1";

    let users = UsersClient::new(dbus.clone()).await?;
    let state = UsersState { users };
    let validation_router = validation_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let router = Router::new()
        .route("/config", get(get_info))
        .route("/user", put(set_first_user).delete(remove_first_user))
        .route(
            "/root_password",
            put(set_root_password).delete(remove_root_password),
        )
        .route(
            "/root_sshkey",
            put(set_root_sshkey).delete(remove_root_sshkey),
        )
        .merge(validation_router)
        .merge(status_router)
        .with_state(state);
    Ok(router)
}

/// Removes the first user settings
#[utoipa::path(delete, path = "/users/user", responses(
    (status = 200, description = "Removes the first user"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn remove_first_user(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_first_user().await?;
    Ok(())
}

#[utoipa::path(put, path = "/users/user", responses(
    (status = 200, description = "User values are set"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn set_first_user(
    State(state): State<UsersState<'_>>,
    Json(config): Json<FirstUser>,
) -> Result<(), Error> {
    state.users.set_first_user(&config).await?;
    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootPasswordSettings {
    pub value: String,
    pub encrypted: bool,
}

#[utoipa::path(delete, path = "/users/root_password", responses(
    (status = 200, description = "Removes the root password"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn remove_root_password(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_root_password().await?;
    Ok(())
}

#[utoipa::path(put, path = "/users/root_password", responses(
    (status = 200, description = "Root password is set"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn set_root_password(
    State(state): State<UsersState<'_>>,
    Json(config): Json<RootPasswordSettings>,
) -> Result<(), Error> {
    state
        .users
        .set_root_password(&config.value, config.encrypted)
        .await?;
    Ok(())
}

#[utoipa::path(delete, path = "/users/root_sshkey", responses(
    (status = 200, description = "Removes the root SSH key"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn remove_root_sshkey(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.set_root_sshkey("").await?;
    Ok(())
}

#[utoipa::path(put, path = "/users/root_sshkey", responses(
    (status = 200, description = "Root SSH Key is set"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn set_root_sshkey(
    State(state): State<UsersState<'_>>,
    Json(key): Json<String>,
) -> Result<(), Error> {
    state.users.set_root_sshkey(key.as_str()).await?;
    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootInfo {
    password: bool,
    sshkey: Option<String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct UsersInfo {
    user: Option<FirstUser>,
    root: RootInfo,
}

#[utoipa::path(put, path = "/users/config", responses(
    (status = 200, description = "Configuration for users including root and the first user", body = UsersInfo),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn get_info(State(state): State<UsersState<'_>>) -> Result<Json<UsersInfo>, Error> {
    let mut result = UsersInfo::default();
    let first_user = state.users.first_user().await?;
    if first_user.user_name.is_empty() {
        result.user = None;
    } else {
        result.user = Some(first_user);
    }
    result.root.password = state.users.is_root_password().await?;
    let ssh_key = state.users.root_ssh_key().await?;
    if ssh_key.is_empty() {
        result.root.sshkey = None;
    } else {
        result.root.sshkey = Some(ssh_key);
    }
    Ok(Json(result))
}
