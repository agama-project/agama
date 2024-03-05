pub mod common;

use agama_server::l10n::web::l10n_service;
use axum::{
    body::Body,
    http::{Request, StatusCode},
    Router,
};
use common::body_to_string;
use tokio::{sync::broadcast::channel, test};
use tower::ServiceExt;

fn build_service() -> Router {
    let (tx, _) = channel(16);
    l10n_service(tx)
}

#[test]
async fn test_get_config() {
    let service = build_service();
    let request = Request::builder()
        .uri("/config")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[test]
async fn test_locales() {
    let service = build_service();
    let request = Request::builder()
        .uri("/locales")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""language":"English""#));
}

#[test]
async fn test_keymaps() {
    let service = build_service();
    let request = Request::builder()
        .uri("/keymaps")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""layout":"us""#));
}

#[test]
async fn test_timezones() {
    let service = build_service();
    let request = Request::builder()
        .uri("/timezones")
        .body(Body::empty())
        .unwrap();
    let response = service.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""code":"Atlantic/Canary""#));
}
