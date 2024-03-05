pub mod common;

use agama_dbus_server::{
    service,
    web::{generate_token, MainServiceBuilder, ServiceConfig},
};
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use common::{body_to_string, DBusServer};
use std::error::Error;
use tokio::{sync::broadcast::channel, test};
use tower::ServiceExt;

async fn build_service() -> Router {
    let (tx, _) = channel(16);
    let server = DBusServer::new().start().await.unwrap();
    service(ServiceConfig::default(), tx, server.connection())
        .await
        .unwrap()
}

#[test]
async fn test_ping() -> Result<(), Box<dyn Error>> {
    let web_service = build_service().await;
    let request = Request::builder().uri("/ping").body(Body::empty()).unwrap();

    let response = web_service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(&body, "{\"status\":\"success\"}");
    Ok(())
}

async fn protected() -> String {
    "OK".to_string()
}

async fn access_protected_route(token: &str, jwt_secret: &str) -> Response {
    let config = ServiceConfig {
        jwt_secret: jwt_secret.to_string(),
    };
    let (tx, _) = channel(16);
    let web_service = MainServiceBuilder::new(tx)
        .add_service("/protected", get(protected))
        .with_config(config)
        .build();

    let request = Request::builder()
        .uri("/protected")
        .method(Method::GET)
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    web_service.oneshot(request).await.unwrap()
}

// TODO: The following test should belong to `auth.rs`
#[test]
async fn test_access_protected_route() -> Result<(), Box<dyn Error>> {
    let token = generate_token("nots3cr3t");
    let response = access_protected_route(&token, "nots3cr3t").await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(body, "OK");
    Ok(())
}
//
// TODO: The following test should belong to `auth.rs`.
#[test]
async fn test_access_protected_route_failed() -> Result<(), Box<dyn Error>> {
    let token = generate_token("nots3cr3t");
    let response = access_protected_route(&token, "wrong").await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}
