//! This module implements the web API for the software module.
//!
//! It is a wrapper around the YaST D-Bus API.

use crate::web::{Event, EventsSender};
use agama_lib::{
    connection,
    error::ServiceError,
    product::{Product, ProductClient},
    software::{
        proxies::{Software1Proxy, SoftwareProductProxy},
        Pattern, SelectionReason, SoftwareClient,
    },
};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use thiserror::Error;
use tokio_stream::StreamExt;

#[derive(Clone)]
struct SoftwareState<'a> {
    product: ProductClient<'a>,
    software: SoftwareClient<'a>,
}

#[derive(Clone, Serialize, Deserialize)]
struct SoftwareConfig {
    patterns: Option<Vec<String>>,
    product: Option<String>,
}

#[derive(Error, Debug)]
pub enum SoftwareError {
    #[error("Service error: {0}")]
    Error(#[from] ServiceError),
}

impl IntoResponse for SoftwareError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

pub async fn software_monitor(connection: zbus::Connection, events: EventsSender) {
    tokio::spawn(monitor_product_changed(connection.clone(), events.clone()));
    tokio::spawn(monitor_patterns_changed(connection.clone(), events.clone()));
}

async fn monitor_product_changed(connection: zbus::Connection, events: EventsSender) {
    let proxy = SoftwareProductProxy::new(&connection).await.unwrap();
    let mut stream = proxy.receive_selected_product_changed().await;
    while let Some(change) = stream.next().await {
        if let Ok(id) = change.get().await {
            _ = events.send(Event::ProductChanged { id });
        }
    }
}

async fn monitor_patterns_changed(connection: zbus::Connection, events: EventsSender) {
    let proxy = Software1Proxy::new(&connection).await.unwrap();
    let mut stream = proxy.receive_selected_patterns_changed().await;
    while let Some(change) = stream.next().await {
        if let Ok(patterns) = change.get().await {
            _ = events.send(Event::PatternsChanged);
        }
    }
}

/// Sets up and returns the axum service for the software module.
///
/// * `events`: channel to send the events to the main service.
pub async fn software_service(_events: EventsSender) -> Router {
    let connection = connection().await.unwrap();
    let product = ProductClient::new(connection.clone()).await.unwrap();
    let software = SoftwareClient::new(connection).await.unwrap();
    let state = SoftwareState { product, software };
    Router::new()
        .route("/products", get(products))
        .route("/patterns", get(patterns))
        .route("/config", put(set_config).get(get_config))
        .with_state(state)
}

/// Returns the list of available products.
///
/// * `state`: service state.
async fn products<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<Product>>, SoftwareError> {
    let products = state.product.products().await?;
    Ok(Json(products))
}

/// Represents a pattern.
///
/// It augments the information coming from the D-Bus client.
#[derive(Serialize)]
pub struct PatternItem {
    #[serde(flatten)]
    pattern: Pattern,
    status: PatternStatus,
}

/// Pattern status.
#[derive(Serialize, Clone, Copy)]
enum PatternStatus {
    Available,
    UserSelected,
    AutoSelected,
}

impl From<SelectionReason> for PatternStatus {
    fn from(value: SelectionReason) -> Self {
        match value {
            SelectionReason::User => Self::UserSelected,
            SelectionReason::Auto => Self::AutoSelected,
        }
    }
}

async fn patterns<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<PatternItem>>, SoftwareError> {
    let patterns = state.software.patterns(true).await?;
    let selected = state.software.selected_patterns().await?;
    let items = patterns
        .into_iter()
        .map(|pattern| {
            let status: PatternStatus = selected
                .get(&pattern.id)
                .map(|r| (*r).into())
                .unwrap_or(PatternStatus::Available);
            PatternItem { pattern, status }
        })
        .collect();

    Ok(Json(items))
}

/// Sets the software configuration.
///
/// * `state`: service state.
/// * `config`: software configuration.
async fn set_config<'a>(
    State(state): State<SoftwareState<'a>>,
    Json(config): Json<SoftwareConfig>,
) -> Result<(), SoftwareError> {
    if let Some(product) = config.product {
        state.product.select_product(&product).await?;
    }

    if let Some(patterns) = config.patterns {
        state.software.select_patterns(&patterns).await?;
    }

    Ok(())
}

/// Returns the software configuration
///
/// * `state` : service state.
async fn get_config<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<SoftwareConfig>, SoftwareError> {
    let product = state.product.product().await?;
    let patterns = state.software.user_selected_patterns().await?;
    let config = SoftwareConfig {
        patterns: Some(patterns),
        product: Some(product),
    };
    Ok(Json(config))
}
