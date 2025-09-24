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

use std::collections::HashMap;

use agama_lib::{
    error::ServiceError,
    issue::Issue,
    product::Product,
    software::{
        model::{RegistrationInfo, ResolvableParams, ResolvableType, SoftwareConfig},
        Pattern, SelectedBy,
    },
};
use axum::{
    extract::{Path, Query, State},
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
        .route("/config", put(set_config).get(get_config))
        .route("/probe", post(probe))
        .route("/proposal", get(get_proposal))
        .route(
            "/resolvables/:id",
            put(set_resolvables).get(get_resolvables),
        )
        .route("/issues/product", get(product_issues))
        .route("/issues/software", get(software_issues))
        .route("/registration", get(get_registration))
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

/// Gets the software configuration.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/software_ng",
    operation_id = "get_software_config",
    responses(
        (status = 200, description = "Get the software configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_config(State(state): State<SoftwareState>) -> Result<Json<SoftwareConfig>, Error> {
    let result = state.client.get_config().await?;

    Ok(Json(result))
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
    let config = state.client.get_config().await?;
    let patterns = config.patterns.unwrap_or(HashMap::new());
    let proposal = SoftwareProposal {
        size: "TODO".to_string(),
        patterns: patterns
            .iter()
            .filter(|(_name, selected)| **selected)
            .map(|(name, _selected)| (name.clone(), SelectedBy::User))
            .collect(),
    };

    Ok(Json(proposal))
}

/// Returns the product issues
///
/// At this point, only the required space is reported.
#[utoipa::path(
    get,
    path = "/issues/product",
    context_path = "/api/software_ng",
    responses(
        (status = 200, description = "Product issues", body = Vec<Issue>)
    )
)]
async fn product_issues(State(state): State<SoftwareState>) -> Result<Json<Vec<Issue>>, Error> {
    // TODO: implement it
    Ok(Json(vec![]))
}

/// Returns the software issues
///
/// At this point, only the required space is reported.
#[utoipa::path(
    get,
    path = "/issues/software",
    context_path = "/api/software_ng",
    responses(
        (status = 200, description = "Product issues", body = Vec<Issue>)
    )
)]
async fn software_issues(State(state): State<SoftwareState>) -> Result<Json<Vec<Issue>>, Error> {
    // TODO: implement it
    Ok(Json(vec![]))
}

/// returns registration info
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/registration",
    context_path = "/api/software",
    responses(
        (status = 200, description = "registration configuration", body = RegistrationInfo),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_registration(
    State(state): State<SoftwareState>,
) -> Result<Json<RegistrationInfo>, Error> {
    // TODO: implement it
    let result = RegistrationInfo {
        registered: false,
        key: "".to_string(),
        email: "".to_string(),
        url: "".to_string(),
    };
    Ok(Json(result))
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

/// Returns the resolvables list with the given `id`.
#[utoipa::path(
    get,
    path = "/resolvables/:id",
    context_path = "/api/software",
    responses(
        (status = 200, description = "Read repositresolvable list"),
        (status = 400, description = "The D-Bus service could not perform the action
")
    )
)]
async fn get_resolvables(
    State(state): State<SoftwareState>,
    Path(id): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<Vec<String>>, Error> {
    let default = "package".to_string();
    let typ = query.get("type").unwrap_or(&default);
    let typ = match typ.as_str() {
        // TODO: support more and move to Resolvable Kind
        "package" => Ok(ResolvableType::Package),
        "pattern" => Ok(ResolvableType::Pattern),
        _ => Err(anyhow::Error::msg("Unknown resolveble type")),
    }?;

    let optional = query
        .get("optional")
        .map_or(false, |v| v.as_str() == "true");

    let result = state.client.get_resolvables(&id, typ, optional).await?;
    Ok(Json(result))
}
