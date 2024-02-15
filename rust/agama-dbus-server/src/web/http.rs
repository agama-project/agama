//! Implements the handlers for the HTTP-based API.
use axum::Json;
use serde_json::{json, Value};

pub async fn ping() -> Json<Value> {
    Json(json!({ "status" : "success" }))
}
