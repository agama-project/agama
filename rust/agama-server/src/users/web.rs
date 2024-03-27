//!
//! The module offers two public functions:
//!
//! * `users_service` which returns the Axum service.
//! * `users_stream` which offers an stream that emits the users events coming from D-Bus.

use axum::{
    extract::State,
    routing::put,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::pin::Pin;
use tokio_stream::{Stream, StreamExt};
use crate::{
    error::Error,
    web::Event
    ,
};
use agama_lib::{
    error::ServiceError, users::{
        proxies::Users1Proxy, FirstUser, FirstUserSettings, UsersClient
    }
};

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
    const FIRST_USER_ID : &str = "first_user";
    const ROOT_PASSWORD_ID : &str = "root_password";
    const ROOT_SSHKEY_ID : &str = "root_sshkey";
    let result : Vec<(&str, Pin<Box<dyn Stream<Item = Event> + Send>>)> = vec![
      (FIRST_USER_ID, Box::pin(first_user_changed_stream(dbus.clone()).await?)),
      (ROOT_PASSWORD_ID, Box::pin(root_password_changed_stream(dbus.clone()).await?)),
      (ROOT_SSHKEY_ID, Box::pin(root_ssh_key_changed_stream(dbus.clone()).await?)),
    ];

    Ok(result)
}

async fn first_user_changed_stream(dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_first_user_changed()
        .await
        .then(|change| async move {
            if let Ok(user) = change.get().await {
                let user_struct = FirstUserSettings {
                    full_name: Some(user.0),
                    user_name: Some(user.1),
                    password: Some(user.2),
                    autologin: Some(user.3),
                };
                return Some(Event::FirstUserChanged(user_struct));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn root_password_changed_stream(dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_root_password_set_changed()
        .await
        .then(|change| async move {
            if let Ok(is_set) = change.get().await {
                return Some(Event::RootPasswordChanged { password_is_set: is_set });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn root_ssh_key_changed_stream(dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = Users1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_root_sshkey_changed()
        .await
        .then(|change| async move {
            if let Ok(key) = change.get().await {
                let value = if key.is_empty() {
                    None 
                } else {
                    Some(key)
                };
                return Some(Event::RootSSHKeyChanged { key: value });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

/// Sets up and returns the axum service for the software module.
pub async fn users_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {

    let users = UsersClient::new(dbus).await?;
    let state = UsersState { users };
    let router = Router::new()
        .route("/first_user", put(set_first_user).delete(remove_first_user))
        .route("/root_password", put(set_root_password).delete(remove_root_password))
        .route("/root_sshkey", put(set_root_password).delete(remove_root_password))
        .with_state(state);
    Ok(router)
}

async fn remove_first_user(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_first_user().await?;
    Ok(())
}

async fn set_first_user(
        State(state): State<UsersState<'_>>,
        Json(config) : Json<FirstUser>
    ) -> Result<(), Error> {
    state.users.set_first_user(&config).await?;
    Ok(())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
pub struct RootPasswordSettings {
    pub value: String,
    pub encrypted: bool,
}

async fn remove_root_password(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.remove_root_password().await?;
    Ok(())
}

async fn set_root_password(
    State(state): State<UsersState<'_>>,
    Json(config) : Json<RootPasswordSettings>
) -> Result<(), Error> {
state.users.set_root_password(&config.value, config.encrypted).await?;
Ok(())
}

async fn remove_root_sshkey(State(state): State<UsersState<'_>>) -> Result<(), Error> {
    state.users.set_root_sshkey("").await?;
    Ok(())
}

async fn set_root_sshkey(
    State(state): State<UsersState<'_>>,
    Json(key) : Json<String>
) -> Result<(), Error> {
state.users.set_root_sshkey(key.as_str()).await?;
Ok(())
}