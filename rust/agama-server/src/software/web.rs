//! This module implements the web API for the software service.
//!
//! The module offers two public functions:
//!
//! * `software_service` which returns the Axum service.
//! * `software_stream` which offers an stream that emits the software events coming from D-Bus.

use crate::{
    error::Error,
    web::{
        common::{issues_router, progress_router, service_status_router},
        Event,
    },
};
use agama_lib::{
    error::ServiceError,
    product::{Product, ProductClient},
    software::{
        proxies::{Software1Proxy, SoftwareProductProxy},
        Pattern, SelectedBy, SoftwareClient, UnknownSelectedBy,
    },
};
use axum::{
    extract::State,
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, pin::Pin};
use tokio_stream::{Stream, StreamExt};

#[derive(Clone)]
struct SoftwareState<'a> {
    product: ProductClient<'a>,
    software: SoftwareClient<'a>,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct SoftwareConfig {
    patterns: Option<Vec<String>>,
    product: Option<String>,
}

/// Returns an stream that emits software related events coming from D-Bus.
///
/// It emits the Event::ProductChanged and Event::PatternsChanged events.
///
/// * `connection`: D-Bus connection to listen for events.
pub async fn software_stream(
    dbus: zbus::Connection,
) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Error> {
    let stream = StreamExt::merge(
        product_changed_stream(dbus.clone()).await?,
        patterns_changed_stream(dbus.clone()).await?,
    );
    Ok(Box::pin(stream))
}

async fn product_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = SoftwareProductProxy::new(&dbus).await?;
    let stream = proxy
        .receive_selected_product_changed()
        .await
        .then(|change| async move {
            if let Ok(id) = change.get().await {
                return Some(Event::ProductChanged { id });
            }
            None
        })
        .filter_map(|e| e);
    Ok(stream)
}

async fn patterns_changed_stream(
    dbus: zbus::Connection,
) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = Software1Proxy::new(&dbus).await?;
    let stream = proxy
        .receive_selected_patterns_changed()
        .await
        .then(|change| async move {
            if let Ok(patterns) = change.get().await {
                return match reason_to_selected_by(patterns) {
                    Ok(patterns) => Some(patterns),
                    Err(error) => {
                        log::warn!("Ignoring the list of changed patterns. Error: {}", error);
                        None
                    }
                };
            }
            None
        })
        .filter_map(|e| e.map(|patterns| Event::SoftwareProposalChanged { patterns }));
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

/// Sets up and returns the axum service for the software module.
pub async fn software_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    const DBUS_SERVICE: &'static str = "org.opensuse.Agama.Software1";
    const DBUS_PATH: &'static str = "/org/opensuse/Agama/Software1";
    const DBUS_PRODUCT_PATH: &'static str = "/org/opensuse/Agama/Software1/Product";

    let status_router = service_status_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let progress_router = progress_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let software_issues = issues_router(&dbus, DBUS_SERVICE, DBUS_PATH).await?;
    let product_issues = issues_router(&dbus, DBUS_SERVICE, DBUS_PRODUCT_PATH).await?;

    let product = ProductClient::new(dbus.clone()).await?;
    let software = SoftwareClient::new(dbus).await?;
    let state = SoftwareState { product, software };
    let router = Router::new()
        .route("/patterns", get(patterns))
        .route("/products", get(products))
        .route("/proposal", get(proposal))
        .route("/config", put(set_config).get(get_config))
        .route("/probe", post(probe))
        .merge(status_router)
        .merge(progress_router)
        .nest("/issues/product", product_issues)
        .nest("/issues/software", software_issues)
        .with_state(state);
    Ok(router)
}

/// Returns the list of available products.
///
/// * `state`: service state.
#[utoipa::path(get, path = "/software/products", responses(
    (status = 200, description = "List of known products", body = Vec<Product>),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn products(State(state): State<SoftwareState<'_>>) -> Result<Json<Vec<Product>>, Error> {
    let products = state.product.products().await?;
    Ok(Json(products))
}

/// Returns the list of software patterns.
///
/// * `state`: service state.
#[utoipa::path(get, path = "/software/patterns", responses(
    (status = 200, description = "List of known software patterns", body = Vec<Pattern>),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn patterns(State(state): State<SoftwareState<'_>>) -> Result<Json<Vec<Pattern>>, Error> {
    let patterns = state.software.patterns(true).await?;
    Ok(Json(patterns))
}

/// Sets the software configuration.
///
/// * `state`: service state.
/// * `config`: software configuration.
#[utoipa::path(put, path = "/software/config", responses(
    (status = 200, description = "Set the software configuration"),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn set_config(
    State(state): State<SoftwareState<'_>>,
    Json(config): Json<SoftwareConfig>,
) -> Result<(), Error> {
    if let Some(product) = config.product {
        state.product.select_product(&product).await?;
    }

    if let Some(patterns) = config.patterns {
        state.software.select_patterns(&patterns).await?;
    }

    Ok(())
}

/// Returns the software configuration.
///
/// * `state` : service state.
#[utoipa::path(get, path = "/software/config", responses(
    (status = 200, description = "Software configuration", body = SoftwareConfig),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn get_config(State(state): State<SoftwareState<'_>>) -> Result<Json<SoftwareConfig>, Error> {
    let product = state.product.product().await?;
    let product = if product.is_empty() {
        None
    } else {
        Some(product)
    };
    let patterns = state.software.user_selected_patterns().await?;
    let config = SoftwareConfig {
        patterns: Some(patterns),
        product,
    };
    Ok(Json(config))
}

#[derive(Serialize, utoipa::ToSchema)]
/// Software proposal information.
pub struct SoftwareProposal {
    /// Space required for installation. It is returned as a formatted string which includes
    /// a number and a unit (e.g., "GiB").
    size: String,
    /// Patterns selection. It is respresented as a hash map where the key is the pattern's name
    /// and the value why the pattern is selected.
    patterns: HashMap<String, SelectedBy>,
}

/// Returns the proposal information.
///
/// At this point, only the required space is reported.
#[utoipa::path(
    get, path = "/software/proposal", responses(
        (status = 200, description = "Software proposal", body = SoftwareProposal)
))]
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
    post, path = "/software/probe", responses(
        (status = 200, description = "Read repositories data"),
        (status = 400, description = "The D-Bus service could not perform the action
")
))]
async fn probe(State(state): State<SoftwareState<'_>>) -> Result<Json<()>, Error> {
    state.software.probe().await?;
    Ok(Json(()))
}
