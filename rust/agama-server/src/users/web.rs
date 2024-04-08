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
use axum::{extract::State, routing::get, Json, Router};
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
    // here we have three streams, but only two events. Reason is
    // that we have three streams from dbus about property change
    // and unify two root user properties into single event to http API
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
                return Some(Event::RootChanged {
                    password: Some(is_set),
                    sshkey: None,
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
                return Some(Event::RootChanged {
                    password: None,
                    sshkey: Some(key),
                });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

/// Sets up and returns the axum service for the users module.
pub async fn users_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Manager1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Users1";

    let users = UsersClient::new(dbus.clone()).await?;
    let state = UsersState { users };
    let validation_router = validation_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let router = Router::new()
        .route(
            "/first",
            get(get_user_config)
                .put(set_first_user)
                .delete(remove_first_user),
        )
        .route("/root", get(get_root_config).patch(patch_root))
        .merge(validation_router)
        .merge(status_router)
        .with_state(state);
    Ok(router)
}

/// Removes the first user settings
#[utoipa::path(delete, path = "/users/first", responses(
    (status = 200, description = "Removes the first user"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn remove_first_user(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_first_user().await?;
    Ok(())
}

#[utoipa::path(put, path = "/users/first", responses(
    (status = 200, description = "Sets the first user"),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn set_first_user(
    State(state): State<UsersState<'_>>,
    Json(config): Json<FirstUser>,
) -> Result<(), Error> {
    state.users.set_first_user(&config).await?;
    Ok(())
}

#[utoipa::path(get, path = "/users/first", responses(
    (status = 200, description = "Configuration for the first user", body = FirstUser),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn get_user_config(State(state): State<UsersState<'_>>) -> Result<Json<FirstUser>, Error> {
    Ok(Json(state.users.first_user().await?))
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

#[utoipa::path(patch, path = "/users/root", responses(
    (status = 200, description = "Root configuration is modified", body = RootPatchSettings),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn patch_root(
    State(state): State<UsersState<'_>>,
    Json(config): Json<RootPatchSettings>,
) -> Result<(), Error> {
    if let Some(key) = config.sshkey {
        state.users.set_root_sshkey(&key).await?;
    }
    if let Some(password) = config.password {
        if password.is_empty() {
            state.users.remove_root_password().await?;
        } else {
            state
                .users
                .set_root_password(&password, config.password_encrypted == Some(true))
                .await?;
        }
    }
    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootConfig {
    /// returns if password for root is set or not
    password: bool,
    /// empty string mean no sshkey is specified
    sshkey: String,
}

#[utoipa::path(get, path = "/users/root", responses(
    (status = 200, description = "Configuration for the root user", body = RootConfig),
    (status = 400, description = "The D-Bus service could not perform the action"),
))]
async fn get_root_config(State(state): State<UsersState<'_>>) -> Result<Json<RootConfig>, Error> {
    let password = state.users.is_root_password().await?;
    let sshkey = state.users.root_ssh_key().await?;
    let config = RootConfig { password, sshkey };
    Ok(Json(config))
}
