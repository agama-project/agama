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
    error::ServiceError,
    product::Product,
    progress::ProgressSummary,
    software::{
        model::{ResolvableParams, SoftwareConfig},
        Pattern,
    },
};
use axum::{
    extract::{Path, State},
    routing::{get, post, put},
    Json, Router,
};

use crate::{error::Error, software::web::SoftwareProposal};

use super::backend::SoftwareServiceClient;

#[derive(Clone)]
struct SoftwareState {
    client: SoftwareServiceClient,
}

pub async fn software_router(client: SoftwareServiceClient) -> Result<Router, ServiceError> {
    let state = SoftwareState { client };
    let router = Router::new()
        .route("/patterns", get(get_patterns))
        .route("/products", get(get_products))
        // FIXME: it should be PATCH (using PUT just for backward compatibility).
        .route("/config", put(set_config))
        .route("/probe", post(probe))
        .route("/proposal", get(get_proposal))
        .route("/resolvables/:id", put(set_resolvables))
        .route("/progress", get(get_progress))
        .with_state(state);
    Ok(router)
}

/// Returns the list of available products.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/products",
    context_path = "/api/software_ng",
    responses(
        (status = 200, description = "List of known products", body = Vec<Product>),
        (status = 400, description = "Cannot read the list of products")
    )
)]
async fn get_products(State(state): State<SoftwareState>) -> Result<Json<Vec<Product>>, Error> {
    let products = state.client.get_products().await?;
    Ok(Json(products))
}

/// Returns the list of available patterns.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/patterns",
    context_path = "/api/software_ng",
    responses(
        (status = 200, description = "List of product patterns", body = Vec<Pattern>),
        (status = 400, description = "Cannot read the list of patterns")
    )
)]
async fn get_patterns(State(state): State<SoftwareState>) -> Result<Json<Vec<Pattern>>, Error> {
    let products = state.client.get_patterns().await?;
    Ok(Json(products))
}

/// Sets the software configuration.
///
/// * `state`: service state.
/// * `config`: software configuration.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/software_ng",
    operation_id = "set_software_config",
    responses(
        (status = 200, description = "Set the software configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<SoftwareState>,
    Json(config): Json<SoftwareConfig>,
) -> Result<(), Error> {
    if let Some(product) = config.product {
        state.client.select_product(&product).await?;
    }

    Ok(())
}

/// Refreshes the repositories.
///
/// At this point, only the required space is reported.
#[utoipa::path(
    post,
    path = "/probe",
    context_path = "/api/software",
    responses(
        (status = 200, description = "Read repositories data"),
        (status = 400, description = "The D-Bus service could not perform the action
")
    ),
    operation_id = "software_probe"
)]
async fn probe(State(state): State<SoftwareState>) -> Result<Json<()>, Error> {
    state.client.probe().await?;
    Ok(Json(()))
}

/// Returns the proposal information.
///
/// At this point, only the required space is reported.
#[utoipa::path(
    get,
    path = "/proposal",
    context_path = "/api/software_ng",
    responses(
        (status = 200, description = "Software proposal", body = SoftwareProposal)
    )
)]
async fn get_proposal(State(state): State<SoftwareState>) -> Result<Json<SoftwareProposal>, Error> {
    unimplemented!("get the software proposal");
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

/// Updates the resolvables list with the given `id`.
#[utoipa::path(
    put,
    path = "/resolvables/:id",
    context_path = "/api/software",
    responses(
        (status = 200, description = "Read repositories data"),
        (status = 400, description = "The D-Bus service could not perform the action
")
    )
)]
async fn set_resolvables(
    State(state): State<SoftwareState>,
    Path(id): Path<String>,
    Json(params): Json<ResolvableParams>,
) -> Result<Json<()>, Error> {
    let names: Vec<_> = params.names.iter().map(|n| n.as_str()).collect();
    state
        .client
        .set_resolvables(&id, params.r#type, &names, params.optional)?;
    Ok(Json(()))
}
