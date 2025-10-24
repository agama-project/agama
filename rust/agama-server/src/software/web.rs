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

//! This module implements the web API for the software service.
//!
//! The module offers two public functions:
//!
//! * `software_service` which returns the Axum service.
//! * `software_stream` which offers an stream that emits the software events coming from D-Bus.

use crate::{
    error::Error,
    web::common::{service_status_router, EventStreams, ProgressClient, ProgressRouterBuilder},
};

use agama_lib::{
    error::ServiceError,
    event,
    http::{self, EventPayload, OldEvent},
    product::{proxies::RegistrationProxy, Product, ProductClient},
    software::{
        model::{
            AddonParams, AddonProperties, Conflict, ConflictSolve, License, LicenseContent,
            LicensesRepo, RegistrationError, RegistrationInfo, RegistrationParams, Repository,
            ResolvableParams, SoftwareConfig,
        },
        proxies::{Software1Proxy, SoftwareProductProxy},
        Pattern, SelectedBy, SoftwareClient, UnknownSelectedBy,
    },
};
use anyhow::Context;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_stream::{Stream, StreamExt};

#[derive(Clone)]
struct SoftwareState<'a> {
    product: ProductClient<'a>,
    software: SoftwareClient<'a>,
    licenses: LicensesRepo,
    // cache the software values, during installation the software service is
    // not responsive (blocked in a libzypp call)
    products: Arc<RwLock<Vec<Product>>>,
    config: Arc<RwLock<Option<SoftwareConfig>>>,
}

/// Returns an stream that emits software related events coming from D-Bus.
///
/// It emits the Event::ProductChanged and Event::PatternsChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn software_streams(dbus: zbus::Connection) -> Result<EventStreams, Error> {
    let result: EventStreams = vec![
        (
            "patterns_changed",
            Box::pin(patterns_changed_stream(dbus.clone()).await?),
        ),
        (
            "conflicts_changed",
            Box::pin(conflicts_changed_stream(dbus.clone()).await?),
        ),
        (
            "product_changed",
            Box::pin(product_changed_stream(dbus.clone()).await?),
        ),
        (
            "registration_code_changed",
            Box::pin(registration_code_changed_stream(dbus.clone()).await?),
        ),
        (
            "registration_email_changed",
            Box::pin(registration_email_changed_stream(dbus.clone()).await?),
        ),
    ];

    Ok(result)
}

async fn product_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = SoftwareProductProxy::new(&dbus).await?;
    let stream = proxy
        .receive_selected_product_changed()
        .await
        .then(|change| async move {
            if let Ok(id) = change.get().await {
                return Some(event!(ProductChanged { id }));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn patterns_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = Software1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_selected_patterns_changed()
        .await
        .then(|change| async move {
            if let Ok(patterns) = change.get().await {
                return match reason_to_selected_by(patterns) {
                    Ok(patterns) => Some(patterns),
                    Err(error) => {
                        tracing::warn!("Ignoring the list of changed patterns. Error: {}", error);
                        None
                    }
                };
            }
            None
        })
        .filter_map(|e| e.map(|patterns| event!(SoftwareProposalChanged { patterns })));
    Ok(stream)
}

async fn conflicts_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = Software1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_conflicts_changed()
        .await
        .then(|change| async move {
            if let Ok(conflicts) = change.get().await {
                return Some(
                    conflicts
                        .into_iter()
                        .map(|c| Conflict::from_dbus(c))
                        .collect(),
                );
            }
            None
        })
        .filter_map(|e| e.map(|conflicts| event!(ConflictsChanged { conflicts })));
    Ok(stream)
}

async fn registration_email_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = RegistrationProxy::new(&dbus).await?;
    let stream = proxy
        .receive_email_changed()
        .await
        .then(|change| async move {
            if let Ok(_id) = change.get().await {
                // TODO: add to stream also proxy and return whole cached registration info
                return Some(event!(RegistrationChanged));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn registration_code_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = OldEvent>, Error> {
    let proxy = RegistrationProxy::new(&dbus).await?;
    let stream = proxy
        .receive_reg_code_changed()
        .await
        .then(|change| async move {
            if let Ok(_id) = change.get().await {
                return Some(event!(RegistrationChanged));
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

// Returns a hash replacing the selection "reason" from D-Bus with a SelectedBy variant.
fn reason_to_selected_by(
    patterns: HashMap<String, u8>,
) -> Result<HashMap<String, SelectedBy>, UnknownSelectedBy> {
    let mut selected: HashMap<String, SelectedBy> = HashMap::new();
    for (id, reason) in patterns {
        match SelectedBy::try_from(reason) {
            Ok(selected_by) => selected.insert(id, selected_by),
            Err(e) => return Err(e),
        };
    }
    Ok(selected)
}

/// Process incoming events.
///
/// * `events`: channel to listen for events.
/// * `products`: list of products (shared behind a mutex).
pub async fn receive_events(
    mut events: http::event::OldReceiver,
    products: Arc<RwLock<Vec<Product>>>,
    config: Arc<RwLock<Option<SoftwareConfig>>>,
    client: ProductClient<'_>,
) {
    while let Ok(event) = events.recv().await {
        match event.payload {
            EventPayload::LocaleChanged { locale: _ } => {
                let mut cached_products = products.write().await;
                if let Ok(products) = client.products().await {
                    *cached_products = products;
                } else {
                    tracing::error!("Could not update the products cached");
                }
            }

            EventPayload::SoftwareProposalChanged { patterns } => {
                let mut cached_config = config.write().await;
                if let Some(config) = cached_config.as_mut() {
                    tracing::debug!(
                        "Updating the patterns list in the software configuration cache"
                    );
                    let user_patterns: HashMap<String, bool> = patterns
                        .into_iter()
                        .filter_map(|(p, s)| {
                            if s == SelectedBy::User {
                                Some((p, true))
                            } else {
                                None
                            }
                        })
                        .collect();
                    config.patterns = Some(user_patterns);
                }
            }

            _ => {}
        }
    }
}

/// Sets up and returns the axum service for the software module.
pub async fn software_service(
    dbus: zbus::Connection,
    events: http::event::OldReceiver,
    progress: ProgressClient,
) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &str = "org.opensuse.Agama.Software1";
    const DBUS_PATH: &str = "/org/opensuse/Agama/Software1";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;

    // FIXME: use anyhow temporarily until we adapt all these methods to return
    // the crate::error::Error instead of ServiceError.
    let progress_router = ProgressRouterBuilder::new(DBUS_SERVICE, DBUS_PATH, progress)
        .build()
        .context("Could not build the progress router")?;

    let mut licenses_repo = LicensesRepo::default();
    if let Err(error) = licenses_repo.read() {
        tracing::error!("Could not read the licenses repository: {:?}", error);
    }

    let product = ProductClient::new(dbus.clone()).await?;
    let software = SoftwareClient::new(dbus).await?;
    let all_products = product.products().await?;

    let state = SoftwareState {
        product,
        software,
        licenses: licenses_repo,
        products: Arc::new(RwLock::new(all_products)),
        config: Arc::new(RwLock::new(None)),
    };

    let cached_products = Arc::clone(&state.products);
    let cached_config = Arc::clone(&state.config);
    let products_client = state.product.clone();
    tokio::spawn(async move {
        receive_events(events, cached_products, cached_config, products_client).await
    });

    let router = Router::new()
        .route("/patterns", get(patterns))
        .route("/conflicts", get(get_conflicts).patch(solve_conflicts))
        .route("/repositories", get(repositories))
        .route("/products", get(products))
        .route("/licenses", get(licenses))
        .route("/licenses/:id", get(license))
        .route(
            "/registration",
            get(get_registration).post(register).delete(deregister),
        )
        .route("/registration/url", put(set_reg_url))
        .route("/registration/addons/register", post(register_addon))
        .route(
            "/registration/addons/registered",
            get(get_registered_addons),
        )
        .route("/registration/addons/available", get(get_available_addons))
        .route("/proposal", get(proposal))
        .route("/config", put(set_config).get(get_config))
        .route("/probe", post(probe))
        .route("/resolvables/:id", put(set_resolvables))
        .merge(status_router)
        .merge(progress_router)
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
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn products(State(state): State<SoftwareState<'_>>) -> Result<Json<Vec<Product>>, Error> {
    let products = state.products.read().await.clone();
    Ok(Json(products))
}

/// Returns the list of defined repositories.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/repositories",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of known repositories", body = Vec<Repository>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn repositories(
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<Vec<Repository>>, Error> {
    let repositories = state.software.repositories().await?;
    Ok(Json(repositories))
}

/// Returns the list of conflicts that proposal found.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/conflicts",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of software conflicts", body = Vec<Conflict>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_conflicts(
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<Vec<Conflict>>, Error> {
    let conflicts = state.software.get_conflicts().await?;
    Ok(Json(conflicts))
}

/// Solve conflicts. Not all conflicts needs to be solved at once.
///
/// * `state`: service state.
#[utoipa::path(
    patch,
    path = "/conflicts",
    context_path = "/api/software",
    request_body = Vec<ConflictSolve>,
    responses(
        (status = 200, description = "Operation success"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn solve_conflicts(
    State(state): State<SoftwareState<'_>>,
    Json(solutions): Json<Vec<ConflictSolve>>,
) -> Result<(), Error> {
    let ret = state.software.solve_conflicts(solutions).await?;

    // refresh the config cache
    let config = read_config(&state).await?;
    tracing::info!("Caching product configuration: {:?}", &config);
    let mut cached_config_write = state.config.write().await;
    *cached_config_write = Some(config);

    Ok(ret)
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
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<RegistrationInfo>, Error> {
    let result = RegistrationInfo {
        registered: state.product.registered().await?,
        key: state.product.registration_code().await?,
        email: state.product.email().await?,
        url: state.product.registration_url().await?,
    };
    Ok(Json(result))
}

/// sets registration server url
///
/// * `state`: service state.
#[utoipa::path(
    put,
    path = "/registration/url",
    context_path = "/api/software",
    responses(
        (status = 200, description = "registration server set"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_reg_url(
    State(state): State<SoftwareState<'_>>,
    Json(config): Json<String>,
) -> Result<(), Error> {
    state.product.set_registration_url(&config).await?;
    Ok(())
}

/// Register product
///
/// * `state`: service state.
#[utoipa::path(
    post,
    path = "/registration",
    context_path = "/api/software",
    responses(
        (status = 204, description = "registration successful"),
        (status = 422, description = "Registration failed. Details are in body", body = RegistrationError),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn register(
    State(state): State<SoftwareState<'_>>,
    Json(config): Json<RegistrationParams>,
) -> Result<impl IntoResponse, Error> {
    let (id, message) = state.product.register(&config.key, &config.email).await?;
    if id == 0 {
        Ok((StatusCode::NO_CONTENT, ().into_response()))
    } else {
        let details = RegistrationError { id, message };
        Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(details).into_response(),
        ))
    }
}

/// returns list of registered addons
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/registration/addons/registered",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of registered addons", body = Vec<AddonParams>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_registered_addons(
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<Vec<AddonParams>>, Error> {
    let result = state.product.registered_addons().await?;

    Ok(Json(result))
}

/// returns list of available addons
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/registration/addons/available",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of available addons", body = Vec<AddonProperties>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn get_available_addons(
    State(state): State<SoftwareState<'_>>,
) -> Result<Json<Vec<AddonProperties>>, Error> {
    let result = state.product.available_addons().await?;

    Ok(Json(result))
}

/// Register an addon
///
/// * `state`: service state.
#[utoipa::path(
    post,
    path = "/registration/addons/register",
    context_path = "/api/software",
    responses(
        (status = 204, description = "registration successful"),
        (status = 422, description = "Registration failed. Details are in the body", body = RegistrationError),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn register_addon(
    State(state): State<SoftwareState<'_>>,
    Json(addon): Json<AddonParams>,
) -> Result<impl IntoResponse, Error> {
    let (id, message) = state.product.register_addon(&addon).await?;
    if id == 0 {
        Ok((StatusCode::NO_CONTENT, ().into_response()))
    } else {
        let details = RegistrationError { id, message };
        Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(details).into_response(),
        ))
    }
}

/// Deregister product
///
/// * `state`: service state.
#[utoipa::path(
    delete,
    path = "/registration",
    context_path = "/api/software",
    responses(
        (status = 200, description = "deregistration successful"),
        (status = 422, description = "De-registration failed. Details are in body", body = RegistrationError),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn deregister(State(state): State<SoftwareState<'_>>) -> Result<impl IntoResponse, Error> {
    let (id, message) = state.product.deregister().await?;
    let details = RegistrationError { id, message };
    if id == 0 {
        Ok((StatusCode::NO_CONTENT, ().into_response()))
    } else {
        Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(details).into_response(),
        ))
    }
}

/// Returns the list of software patterns.
///
/// * `state`: service state.
#[utoipa::path(
    get,
    path = "/patterns",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of known software patterns", body = Vec<Pattern>),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn patterns(State(state): State<SoftwareState<'_>>) -> Result<Json<Vec<Pattern>>, Error> {
    let patterns = state.software.patterns(true).await?;
    Ok(Json(patterns))
}

/// Sets the software configuration.
///
/// * `state`: service state.
/// * `config`: software configuration.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/software",
    operation_id = "set_software_config",
    responses(
        (status = 200, description = "Set the software configuration"),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]
async fn set_config(
    State(state): State<SoftwareState<'_>>,
    Json(config): Json<SoftwareConfig>,
) -> Result<(), Error> {
    {
        // first invalidate cache, so if it fails later, we know we need to re-read recent data
        // use minimal context so it is released soon.
        tracing::debug!("Invalidating product configuration cache");
        let mut cached_config_invalidate = state.config.write().await;
        *cached_config_invalidate = None;
    }

    // first set only require flag to ensure that it is used for later computing of solver
    if let Some(only_required) = config.only_required {
        state.software.set_only_required(only_required).await?;
    }

    if let Some(product) = config.product {
        state.product.select_product(&product).await?;
    }

    if let Some(patterns) = config.patterns {
        state.software.select_patterns(patterns).await?;
    }

    if let Some(packages) = config.packages {
        state.software.select_packages(packages).await?;
    }

    if let Some(repositories) = config.extra_repositories {
        state.software.set_user_repositories(repositories).await?;
    }

    // load the config cache
    let config = read_config(&state).await?;
    tracing::debug!("Caching software configuration (set_config): {:?}", &config);
    let mut cached_config_write = state.config.write().await;
    *cached_config_write = Some(config);

    Ok(())
}

/// Returns the software configuration.
///
/// * `state` : service state.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/software",
    operation_id = "get_software_config",
    responses(
        (status = 200, description = "Software configuration", body = SoftwareConfig),
        (status = 400, description = "The D-Bus service could not perform the action")
    )
)]

async fn get_config(State(state): State<SoftwareState<'_>>) -> Result<Json<SoftwareConfig>, Error> {
    let cached_config = state.config.read().await.clone();

    if let Some(config) = cached_config {
        tracing::debug!("Returning cached software config: {:?}", &config);
        return Ok(Json(config));
    }

    let config = read_config(&state).await?;
    tracing::debug!("Caching software configuration (get_config): {:?}", &config);
    let mut cached_config_write = state.config.write().await;
    *cached_config_write = Some(config.clone());

    Ok(Json(config))
}

/// Helper function
/// * `state` : software service state
async fn read_config(state: &SoftwareState<'_>) -> Result<SoftwareConfig, Error> {
    let product = state.product.product().await?;
    let product = if product.is_empty() {
        None
    } else {
        Some(product)
    };
    let patterns = state
        .software
        .user_selected_patterns()
        .await?
        .into_iter()
        .map(|p| (p, true))
        .collect();
    let packages = state.software.user_selected_packages().await?;
    let repos = state.software.user_repositories().await?;

    Ok(SoftwareConfig {
        patterns: Some(patterns),
        packages: Some(packages),
        product,
        extra_repositories: if repos.is_empty() { None } else { Some(repos) },
        only_required: state.software.get_only_required().await?,
    })
}

#[derive(Serialize, utoipa::ToSchema)]
/// Software proposal information.
pub struct SoftwareProposal {
    /// Space required for installation. It is returned as a formatted string which includes
    /// a number and a unit (e.g., "GiB").
    size: String,
    /// Patterns selection. It is represented as a hash map where the key is the pattern's name
    /// and the value why the pattern is selected.
    patterns: HashMap<String, SelectedBy>,
}

/// Returns the proposal information.
///
/// At this point, only the required space is reported.
#[utoipa::path(
    get,
    path = "/proposal",
    context_path = "/api/software",
    responses(
        (status = 200, description = "Software proposal", body = SoftwareProposal)
    )
)]
async fn proposal(State(state): State<SoftwareState<'_>>) -> Result<Json<SoftwareProposal>, Error> {
    let size = state.software.used_disk_space().await?;
    let patterns = state.software.selected_patterns().await?;
    let proposal = SoftwareProposal { size, patterns };
    Ok(Json(proposal))
}

/// Returns the proposal information.
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
async fn probe(State(state): State<SoftwareState<'_>>) -> Result<Json<()>, Error> {
    state.software.probe().await?;
    Ok(Json(()))
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
    State(state): State<SoftwareState<'_>>,
    Path(id): Path<String>,
    Json(params): Json<ResolvableParams>,
) -> Result<Json<()>, Error> {
    let names: Vec<_> = params.names.iter().map(|n| n.as_str()).collect();
    state
        .software
        .set_resolvables(&id, params.r#type, &names, params.optional)
        .await?;
    Ok(Json(()))
}

/// Returns the list of known licenses.
///
/// It includes the license ID and the languages in which it is available.
#[utoipa::path(
    get,
    path = "/licenses",
    context_path = "/api/software",
    responses(
        (status = 200, description = "List of known licenses", body = Vec<License>)
    )
)]
async fn licenses(State(state): State<SoftwareState<'_>>) -> Result<Json<Vec<License>>, Error> {
    Ok(Json(state.licenses.licenses.clone()))
}

#[derive(Deserialize, utoipa::IntoParams)]
struct LicenseQuery {
    lang: Option<String>,
}

/// Returns the license content.
///
/// Optionally it can receive a language tag (RFC 5646). Otherwise, it returns
/// the license in English.
#[utoipa::path(
    get,
    path = "/licenses/:id",
    context_path = "/api/software",
    params(LicenseQuery),
    responses(
        (status = 200, description = "License with the given ID", body = LicenseContent),
        (status = 400, description = "The specified language tag is not valid"),
        (status = 404, description = "There is not license with the given ID")
    )
)]
async fn license(
    State(state): State<SoftwareState<'_>>,
    Path(id): Path<String>,
    Query(query): Query<LicenseQuery>,
) -> Result<Response, Error> {
    let lang = query.lang.unwrap_or("en".to_string());

    let Ok(lang) = lang.as_str().try_into() else {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    };

    if let Some(license) = state.licenses.find(&id, &lang) {
        Ok(Json(license).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
}
