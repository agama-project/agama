mod common;

use self::common::DBusServer;
use agama_dbus_server::{service, web::generate_token, web::ServiceConfig};
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use http_body_util::BodyExt;
use std::error::Error;
use tokio::test;
use tower::ServiceExt;

async fn body_to_string(body: Body) -> String {
    let bytes = body.collect().await.unwrap().to_bytes();
    String::from_utf8(bytes.to_vec()).unwrap()
}

#[test]
async fn test_ping() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let web_server = service(ServiceConfig::default(), dbus_server.connection());
    let request = Request::builder().uri("/ping").body(Body::empty()).unwrap();

    let response = web_server.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(&body, "{\"status\":\"success\"}");
    Ok(())
}

#[test]
async fn test_authenticate() -> Result<(), Box<dyn Error>> {
    let dbus_server = DBusServer::new().start().await?;
    let config = ServiceConfig {
        jwt_secret: "nots3cr3t".to_string(),
    };
    let web_server = service(config, dbus_server.connection());
    let token = generate_token("nots3cr3t");
    let request = Request::builder()
        .uri("/protected")
        .method(Method::GET)
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let response = web_server.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(body, "OK");
    Ok(())
}
