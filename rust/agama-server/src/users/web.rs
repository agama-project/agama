//!
//! The module offers two public functions:
//!
//! * `users_service` which returns the Axum service.
//! * `users_stream` which offers an stream that emits the users events coming from D-Bus.

use axum::{
    extract::State,
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, pin::Pin};
use tokio_stream::{Stream, StreamExt, StreamMap};
use crate::{
    error::Error,
    web::{
        common::{issues_router, progress_router, service_status_router},
        Event,
    },
};
use agama_lib::{
    connection, error::ServiceError, users::{
        proxies::Users1Proxy, FirstUserSettings, UsersClient
    }
};

#[derive(Clone)]
struct UsersState<'a> {
    users: UsersClient<'a>,
}

/// Returns an stream that emits users related events coming from D-Bus.
///
/// It emits the Event::RootPasswordChange, Event::RootSSHKeyChanged and Event::FirstUserChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
/// * `map`: stream map to which it adds streams
pub async fn add_users_streams(
    dbus: zbus::Connection,
    mut map: StreamMap<&str, Pin<Box<dyn Stream<Item = Event> + Send>>>,
) -> Result<StreamMap<&str, Pin<Box<dyn Stream<Item = Event> + Send>>>, Error> {
    map.insert("first_user", Box::pin(first_user_changed_stream(dbus.clone()).await?));
    map.insert("root_password", Box::pin(root_password_changed_stream(dbus.clone()).await?));
    map.insert("root_sshkey", Box::pin(root_ssh_key_changed_stream(dbus.clone()).await?));
    Ok(map)
}

async fn first_user_changed_stream(dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
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
) -> Result<impl Stream<Item = Event>, Error> {
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
) -> Result<impl Stream<Item = Event>, Error> {
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
        .with_state(state);
    Ok(router)
}
