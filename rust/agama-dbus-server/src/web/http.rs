//! Implements the handlers for the HTTP-based API.

use axum::Json;
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Serialize, ToSchema)]
pub struct PingResponse {
    /// API status
    status: String,
}

#[utoipa::path(get, path = "/ping", responses(
    (status = 200, description = "The API is working", body = PingResponse)
))]
pub async fn ping() -> Json<PingResponse> {
    Json(PingResponse {
        status: "success".to_string(),
    })
}
