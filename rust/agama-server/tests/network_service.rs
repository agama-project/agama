pub mod common;

use crate::common::DBusServer;
use agama_lib::error::ServiceError;
use agama_lib::network::types::{DeviceType, SSID};
use agama_server::network::web::network_service;
use agama_server::network::{
    self,
    model::{self, AccessPoint, GeneralState, StateConfig},
    Adapter, NetworkAdapterError, NetworkState,
};

use async_trait::async_trait;
use axum::http::header;
use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    Router,
};
use common::body_to_string;
use serde_json::to_string;
use std::error::Error;
use tokio::{sync::broadcast, test};
use tower::ServiceExt;

fn public_dir() -> PathBuf {
    std::env::current_dir().unwrap().join("public")
}
async fn build_state() -> NetworkState {
    let general_state = GeneralState::default();
    let device = model::Device {
        name: String::from("eth0"),
        type_: DeviceType::Ethernet,
    };
    let eth0 = model::Connection::new("eth0".to_string(), DeviceType::Ethernet);

    NetworkState::new(general_state, vec![], vec![device], vec![eth0])
}

async fn build_service(state: NetworkState) -> Result<Router, ServiceError> {
    let dbus = DBusServer::new().start().await?.connection();

    let adapter = NetworkTestAdapter(state);
    Ok(network_service(dbus, adapter).await?)
}

#[derive(Default)]
pub struct NetworkTestAdapter(network::NetworkState);

#[async_trait]
impl Adapter for NetworkTestAdapter {
    async fn read(&self, _: StateConfig) -> Result<network::NetworkState, NetworkAdapterError> {
        Ok(self.0.clone())
    }

    async fn write(&self, _network: &network::NetworkState) -> Result<(), NetworkAdapterError> {
        unimplemented!("Not used in tests");
    }
}

#[test]
async fn test_network_state() -> Result<(), Box<dyn Error>> {
    let state = build_state().await;
    let network_service = build_service(state).await?;

    let request = Request::builder()
        .uri("/state")
        .method(Method::GET)
        .body(Body::empty())
        .unwrap();

    let response = network_service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""wireless_enabled":false"#));
    Ok(())
}

#[test]
async fn test_change_network_state() -> Result<(), Box<dyn Error>> {
    let mut state = build_state().await;
    let network_service = build_service(state.clone()).await?;
    state.general_state.wireless_enabled = true;

    let request = Request::builder()
        .uri("/state")
        .method(Method::PUT)
        .header(header::CONTENT_TYPE, "application/json")
        .body(to_string(&state.general_state)?)
        .unwrap();

    let response = network_service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = response.into_body();
    let body = body_to_string(body).await;
    assert_eq!(body, to_string(&state.general_state)?);
    Ok(())
}

#[test]
async fn test_network_connections() -> Result<(), Box<dyn Error>> {
    let state = build_state().await;
    let network_service = build_service(state.clone()).await?;

    let request = Request::builder()
        .uri("/connections")
        .method(Method::GET)
        .body(Body::empty())
        .unwrap();

    let response = network_service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""id":"eth0""#));
    Ok(())
}

#[test]
async fn test_network_devices() -> Result<(), Box<dyn Error>> {
    let state = build_state().await;
    let network_service = build_service(state.clone()).await?;

    let request = Request::builder()
        .uri("/devices")
        .method(Method::GET)
        .body(Body::empty())
        .unwrap();

    let response = network_service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""name":"eth0""#));
    Ok(())
}

#[test]
async fn test_network_wifis() -> Result<(), Box<dyn Error>> {
    let mut state = build_state().await;
    state.access_points = vec![
        AccessPoint {
            ssid: SSID("AgamaNetwork".as_bytes().into()),
            hw_address: "00:11:22:33:44:00".into(),
            ..Default::default()
        },
        AccessPoint {
            ssid: SSID("AgamaNetwork2".as_bytes().into()),
            hw_address: "00:11:22:33:44:01".into(),
            ..Default::default()
        },
    ];
    let network_service = build_service(state.clone()).await?;

    let request = Request::builder()
        .uri("/wifi")
        .method(Method::GET)
        .body(Body::empty())
        .unwrap();

    let response = network_service.oneshot(request).await?;
    assert_eq!(response.status(), StatusCode::OK);
    let body = body_to_string(response.into_body()).await;
    assert!(body.contains(r#""ssid":"AgamaNetwork""#));
    assert!(body.contains(r#""ssid":"AgamaNetwork2""#));
    Ok(())
}
