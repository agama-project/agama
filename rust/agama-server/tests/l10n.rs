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

pub mod common;

use std::error::Error;

use agama_server::l10n::web::l10n_service;
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use common::{body_to_string, DBusServer};
use tokio::{sync::broadcast::channel, test};
use tower::ServiceExt;

async fn build_service(dbus: zbus::Connection) -> Router {
    let (tx, _) = channel(16);
    l10n_service(dbus, tx).await.unwrap()
}

#[test]
async fn test_get_config() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let service = build_service(dbus_server.connection()).await;
    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    Ok(())
}

#[test]
async fn test_locales() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let service = build_service(dbus_server.connection()).await;
    let request = Request::builder()
        .uri("/locales")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""language":"English""#));
    Ok(())
}

#[test]
async fn test_keymaps() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let service = build_service(dbus_server.connection()).await;
    let request = Request::builder()
        .uri("/keymaps")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""id":"us""#));
    Ok(())
}

#[test]
async fn test_timezones() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let service = build_service(dbus_server.connection()).await;
    let request = Request::builder()
        .uri("/timezones")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""code":"Atlantic/Canary""#));
    Ok(())
}

#[test]
async fn test_set_config_locales() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let service = build_service(dbus_server.connection()).await;

    let content = "{\"locales\":[\"es_ES.UTF-8\"]}";
    let body = Body::from(content);
    let request = Request::patch("/config")
        .header("Content-Type", "application/json")
        .body(body)?;
    let response = service.clone().oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // check whether the value changed
    let request = Request::get("/config")
        .header("Content-Type", "application/json")
        .body(Body::empty())?;
    let response = service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""locales":["es_ES.UTF-8"]"#));

    // TODO: check whether the D-Bus value was synchronized

    Ok(())
}
