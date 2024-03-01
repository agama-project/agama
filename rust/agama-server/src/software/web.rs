//! This module implements the web API for the software module.
//!
//! It is a wrapper around the YaST D-Bus API.

use crate::web::{Event, EventsSender};
use agama_lib::{connection, product::Product, software::proxies::SoftwareProductProxy};
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
    product: SoftwareProductProxy<'a>,
}

#[derive(Clone, Serialize, Deserialize)]
struct SoftwareConfig {
    patterns: Option<Vec<String>>,
    product: Option<String>,
}

#[derive(Error, Debug)]
pub enum SoftwareError {
    #[error("Service error: {0}")]
    Error(#[from] zbus::Error),
}

impl IntoResponse for SoftwareError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

pub async fn software_monitor(events: EventsSender) {
    let connection = connection().await.unwrap();
    let proxy = SoftwareProductProxy::new(&connection).await.unwrap();
    let mut stream = proxy.receive_selected_product_changed().await;
    while let Some(change) = stream.next().await {
        if let Ok(id) = change.get().await {
            _ = events.send(Event::ProductChanged { id });
        }
    }
}

/// Sets up and returns the axum service for the software module.
///
/// * `events`: channel to send the events to the main service.
pub async fn software_service(_events: EventsSender) -> Router {
    let connection = connection().await.unwrap();
    let proxy = SoftwareProductProxy::new(&connection).await.unwrap();
    let state = SoftwareState { product: proxy };
    Router::new()
        .route("/products", get(products))
        .route("/config", put(set_config).get(get_config))
        .with_state(state)
}

/// Returns the list of available products.
///
/// * `state`: service state.
async fn products<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<Product>>, SoftwareError> {
    let products = state.product.available_products().await?;
    let products = products
        .into_iter()
        .map(|(id, name, data)| {
            let description = data
                .get("description")
                .and_then(|d| d.downcast_ref::<str>())
                .unwrap_or("");

            Product {
                id,
                name,
                description: description.to_string(),
            }
        })
        .collect();

    Ok(Json(products))
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
    Ok(())
}

/// Returns the software configuration
///
/// * `state` : service state.
async fn get_config<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<SoftwareConfig>, SoftwareError> {
    let product = state.product.selected_product().await?;
    let config = SoftwareConfig {
        patterns: Some(vec![]),
        product: Some(product),
    };
    Ok(Json(config))
}
