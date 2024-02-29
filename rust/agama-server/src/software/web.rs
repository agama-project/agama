//! This module implements the web API for the software module.
//!
//! It is a wrapper around the YaST D-Bus API.

use crate::web::EventsSender;
use agama_lib::{connection, product::Product, software::proxies::SoftwareProductProxy};
use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde_json::json;
use thiserror::Error;

#[derive(Clone)]
struct SoftwareState<'a> {
    software: SoftwareProductProxy<'a>,
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

/// Sets up and returns the axum service for the software module.
///
/// * `events`: channel to send the events to the main service.
pub async fn software_service(_events: EventsSender) -> Router {
    let connection = connection().await.unwrap();
    let proxy = SoftwareProductProxy::new(&connection).await.unwrap();
    let state = SoftwareState { software: proxy };
    Router::new()
        .route("/products", get(products))
        .with_state(state)
}

/// Returns the list of available products.
///
/// * `state`: service state.
async fn products<'a>(
    State(state): State<SoftwareState<'a>>,
) -> Result<Json<Vec<Product>>, SoftwareError> {
    let products = state.software.available_products().await?;
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
