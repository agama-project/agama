//! This module implements the web API for the software module.
//!
//! The module offers two public functions:
//!
//! * `software_service` which returns the Axum service.
//! * `software_stream` which offers an stream that emits the software events coming from D-Bus.

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
use tokio_stream::{Stream, StreamExt};

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

/// Returns an stream that emits software related events coming from D-Bus.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn software_stream(connection: zbus::Connection) -> impl Stream<Item = Event> {
    StreamExt::merge(
        product_changed_stream(connection.clone()).await,
        patterns_changed_stream(connection.clone()).await,
    )
}

async fn product_changed_stream(connection: zbus::Connection) -> impl Stream<Item = Event> {
    let proxy = SoftwareProductProxy::new(&connection).await.unwrap();
    proxy
        .receive_selected_product_changed()
        .await
        .then(|change| async move {
            if let Ok(id) = change.get().await {
                return Some(Event::ProductChanged { id });
            }
            None
        })
        .filter_map(|e| e)
}

async fn patterns_changed_stream(connection: zbus::Connection) -> impl Stream<Item = Event> {
    let proxy = Software1Proxy::new(&connection).await.unwrap();
    proxy
        .receive_selected_patterns_changed()
        .await
        .then(|change| async move {
            if let Ok(_pattens) = change.get().await {
                return Some(Event::PatternsChanged);
            }
            None
        })
        .filter_map(|e| e)
}

/// Sets up and returns the axum service for the software module.
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
#[utoipa::path(get, path = "/software/products", responses(
    (status = 200, description = "List of known products")
))]
async fn products<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<Product>>, SoftwareError> {
    let products = state.product.products().await?;
    Ok(Json(products))
}

/// Represents a pattern.
///
/// It augments the information coming from the D-Bus client.
#[derive(Serialize, utoipa::ToSchema)]
pub struct PatternEntry {
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

/// Returns the list of software patterns.
///
/// * `state`: service state.
#[utoipa::path(get, path = "/software/patterns", responses(
    (status = 200, description = "List of known software patterns")
))]
async fn patterns<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<PatternEntry>>, SoftwareError> {
    let patterns = state.software.patterns(true).await?;
    let selected = state.software.selected_patterns().await?;
    let items = patterns
        .into_iter()
        .map(|pattern| {
            let status: PatternStatus = selected
                .get(&pattern.id)
                .map(|r| (*r).into())
                .unwrap_or(PatternStatus::Available);
            PatternEntry { pattern, status }
        })
        .collect();

    Ok(Json(items))
}

/// Sets the software configuration.
///
/// * `state`: service state.
/// * `config`: software configuration.
#[utoipa::path(put, path = "/software/config", responses(
    (status = 200, description = "Set the software configuration")
))]
async fn set_config(
    State(state): State<SoftwareState<'_>>,
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
#[utoipa::path(get, path = "/software/config", responses(
    (status = 200, description = "Software configuration")
))]
async fn get_config(
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<SoftwareConfig>, SoftwareError> {
    let product = state.product.product().await?;
    let patterns = state.software.user_selected_patterns().await?;
    let config = SoftwareConfig {
        patterns: Some(patterns),
        product: Some(product),
    };
    Ok(Json(config))
}
