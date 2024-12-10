// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use agama_lib::{
    error::ServiceError, product::Product, progress::ProgressSummary
};
use axum::{extract::State, routing::get, Json, Router};

use crate::{error::Error, software::web::SoftwareProposal};

use super::backend::SoftwareServiceClient;

#[derive(Clone)]
struct SoftwareState {
    client: SoftwareServiceClient,
}

pub async fn software_router(client: SoftwareServiceClient) -> Result<Router, ServiceError> {
    let state = SoftwareState { client };
    let router = Router::new()
        .route("/products", get(get_products))
        .with_state(state);
    Ok(router)
}

/// Returns the list of available products.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/products",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of known products", body = Vec<Product>),
        (status = 400, description = "Cannot read the list of products")
    )
)]
async fn get_products(State(state): State<SoftwareState>) -> Result<Json<Vec<Product>>, Error> {
    let products = state.client.get_products().await?;
    Ok(Json(products))
}

#[utoipa::path(
    get,
    path = "/progress",
    context_path = "/api/software",
    responses(
        (status = 200, description = "Progress summary", body = ProgressSummary),
    )
)]
async fn get_progress(State(state): State<SoftwareState>) -> Result<Json<ProgressSummary>, Error> {
    let summary = match state.client.get_progress().await? {
        Some(summary) => summary,
        None => ProgressSummary::finished(),
    };
    Ok(Json(summary))
}
