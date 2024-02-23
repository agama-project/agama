mod common;

use self::common::DBusServer;
use agama_dbus_server::{service, web::generate_token, web::ServiceConfig};
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    response::Response,
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

async fn access_protected_route(token: &str, jwt_secret: &str) -> Response {
    let dbus_server = DBusServer::new().start().await.unwrap();
    let config = ServiceConfig {
        jwt_secret: jwt_secret.to_string(),
    };
    let web_server = service(config);
    let request = Request::builder()
        .uri("/protected")
        .method(Method::GET)
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    web_server.oneshot(request).await.unwrap()
}

// TODO: The following test should belong to `auth.rs`. However, we need a working
// D-Bus connection which is not available on containers. Let's keep the test
// here until by now.
#[test]
async fn test_access_protected_route() -> Result<(), Box<dyn Error>> {
    let token = generate_token("nots3cr3t");
    let response = access_protected_route(&token, "nots3cr3t").await;
    assert_eq!(response.status(), StatusCode::OK);

    let body = body_to_string(response.into_body()).await;
    assert_eq!(body, "OK");
    Ok(())
}

// TODO: The following test should belong to `auth.rs`. However, we need a working
// D-Bus connection which is not available on containers. Let's keep the test
// here until by now.
#[test]
async fn test_access_protected_route_failed() -> Result<(), Box<dyn Error>> {
    let token = generate_token("nots3cr3t");
    let response = access_protected_route(&token, "wrong").await;
    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    Ok(())
}
