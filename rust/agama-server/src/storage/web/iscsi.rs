//! This module implements the web API for the iSCSI handling of the storage service.
//!
//! The module offers two public functions:
//!
//! * `iscsi_service` which returns the Axum service.
//! * `iscsi_stream` which offers an stream that emits the iSCSI-related events coming from D-Bus.

use crate::{
    error::Error,
    web::{common::EventStreams, Event},
};
use agama_lib::{
    dbus::{get_optional_property, to_owned_hash},
    error::ServiceError,
    storage::{
        client::iscsi::{ISCSIAuth, ISCSIInitiator, ISCSINode, LoginResult},
        ISCSIClient,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
    Json, Router,
};
use serde::Deserialize;

mod stream;
use stream::ISCSINodeStream;
use tokio_stream::{Stream, StreamExt};
use zbus::{
    fdo::{PropertiesChanged, PropertiesProxy},
    names::InterfaceName,
};

/// Returns the stream of iSCSI-related events.
///
/// The stream combines the following events:
///
/// * Changes on the iSCSI nodes collection.
/// * Changes to the initiator (name or ibft).
///
/// * `dbus`: D-Bus connection to use.
pub async fn iscsi_stream(dbus: &zbus::Connection) -> Result<EventStreams, Error> {
    let stream: EventStreams = vec![
        ("iscsi_nodes", Box::pin(ISCSINodeStream::new(dbus).await?)),
        ("initiator", Box::pin(initiator_stream(dbus).await?)),
    ];
    Ok(stream)
}

async fn initiator_stream(
    dbus: &zbus::Connection,
) -> Result<impl Stream<Item = Event> + Send, Error> {
    let proxy = PropertiesProxy::builder(dbus)
        .destination("org.opensuse.Agama.Storage1")?
        .path("/org/opensuse/Agama/Storage1")?
        .build()
        .await?;
    let stream = proxy
        .receive_properties_changed()
        .await?
        .filter_map(|change| match handle_initiator_change(change) {
            Ok(event) => event,
            Err(error) => {
                log::warn!("Could not read the initiator change: {}", error);
                None
            }
        });
    Ok(stream)
}

fn handle_initiator_change(change: PropertiesChanged) -> Result<Option<Event>, ServiceError> {
    let args = change.args()?;
    let iscsi_iface =
        InterfaceName::from_str_unchecked("org.opensuse.Agama.Storage1.ISCSI.Initiator");
    if iscsi_iface != args.interface_name {
        return Ok(None);
    }
    let changes = to_owned_hash(args.changed_properties());
    let name = get_optional_property(&changes, "InitiatorName")?;
    let ibft = get_optional_property(&changes, "IBFT")?;
    Ok(Some(Event::ISCSIInitiatorChanged { ibft, name }))
}

#[derive(Clone)]
struct ISCSIState<'a> {
    client: ISCSIClient<'a>,
}

/// Sets up and returns the Axum service for the iSCSI part of the storage module.
///
/// It acts as a proxy to Agama D-Bus service.
///
/// * `dbus`: D-Bus connection to use.
pub async fn iscsi_service<T>(dbus: &zbus::Connection) -> Result<Router<T>, ServiceError> {
    let client = ISCSIClient::new(dbus.clone()).await?;
    let state = ISCSIState { client };
    let router = Router::new()
        .route("/initiator", get(initiator).patch(update_initiator))
        .route("/nodes", get(nodes))
        .route("/nodes/:id", delete(delete_node).patch(update_node))
        .route("/nodes/:id/login", post(login_node))
        .route("/nodes/:id/logout", post(logout_node))
        .route("/discover", post(discover))
        .with_state(state);
    Ok(router)
}

/// Returns the iSCSI initiator properties.
///
/// The iSCSI properties include the name and whether iBFT is enabled.
#[utoipa::path(
    get,
    path="/initiator",
    context_path="/api/storage/iscsi",
    responses(
        (status = OK, description = "iSCSI initiator properties.", body = ISCSIInitiator),
        (status = BAD_REQUEST, description = "It could not read the iSCSI initiator properties."),
    )
)]
async fn initiator(State(state): State<ISCSIState<'_>>) -> Result<Json<ISCSIInitiator>, Error> {
    let initiator = state.client.get_initiator().await?;
    Ok(Json(initiator))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct InitiatorParams {
    /// iSCSI initiator name.
    name: String,
}

/// Updates the iSCSI initiator properties.
#[utoipa::path(
    patch,
    path="/initiator",
    context_path="/api/storage/iscsi",
    responses(
        (status = NO_CONTENT, description = "The iSCSI initiator properties were succesfully updated."),
        (status = BAD_REQUEST, description = "It could not update the iSCSI initiator properties."),
    )
)]
async fn update_initiator(
    State(state): State<ISCSIState<'_>>,
    Json(params): Json<InitiatorParams>,
) -> Result<impl IntoResponse, Error> {
    state.client.set_initiator_name(&params.name).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Returns the list of known iSCSI nodes.
#[utoipa::path(
    get,
    path="/nodes",
    context_path="/api/storage/iscsi",
    responses(
    (status = OK, description = "List of iSCSI nodes.", body = Vec<ISCSINode>),
    (status = BAD_REQUEST, description = "It was not possible to get the list of iSCSI nodes."),
  )
)]
async fn nodes(State(state): State<ISCSIState<'_>>) -> Result<Json<Vec<ISCSINode>>, Error> {
    let nodes = state.client.get_nodes().await?;
    Ok(Json(nodes))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct NodeParams {
    /// Startup value.
    startup: String,
}

/// Updates iSCSI node properties.
///
/// At this point, only the startup option can be changed.
#[utoipa::path(
    put,
    path="/nodes/{id}",
    context_path="/api/storage/iscsi",
    params(
        ("id" = u32, Path, description = "iSCSI artificial ID.")
    ),
    responses(
        (status = NO_CONTENT, description = "The iSCSI node was updated.", body = NodeParams),
        (status = BAD_REQUEST, description = "Could not update the iSCSI node."),
    )
)]
async fn update_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
    Json(params): Json<NodeParams>,
) -> Result<impl IntoResponse, Error> {
    state.client.set_startup(id, &params.startup).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// Deletes the iSCSI node.
#[utoipa::path(
    delete,
    path="/nodes/{id}",
    context_path="/api/storage/iscsi",
    params(
        ("id" = u32, Path, description = "iSCSI artificial ID.")
    ),
    responses(
        (status = NO_CONTENT, description = "The iSCSI node was deleted."),
        (status = BAD_REQUEST, description = "Could not delete the iSCSI node."),
    )
)]
async fn delete_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    state.client.delete_node(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct LoginParams {
    /// Authentication options.
    #[serde(flatten)]
    auth: ISCSIAuth,
    /// Startup value.
    startup: String,
}

#[utoipa::path(
    post,
    path="/nodes/{id}/login",
    context_path="/api/storage/iscsi",
    params(
        ("id" = u32, Path, description = "iSCSI artificial ID.")
    ),
    responses(
        (status = NO_CONTENT, description = "The login request was successful."),
        (status = BAD_REQUEST, description = "Could not reach the iSCSI server."),
        (status = UNPROCESSABLE_ENTITY, description = "The login request failed.",
             body = LoginResult),
    )
)]
async fn login_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
    Json(params): Json<LoginParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state.client.login(id, params.auth, params.startup).await?;
    match result {
        LoginResult::Success => Ok((StatusCode::NO_CONTENT, ().into_response())),
        error => Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(error).into_response(),
        )),
    }
}

#[utoipa::path(
    post,
    path="/nodes/{id}/logout",
    context_path="/api/storage/iscsi",
    params(
        ("id" = u32, Path, description = "iSCSI artificial ID.")
    ),
    responses(
        (status = 204, description = "The logout request was successful."),
        (status = 400, description = "Could not reach the iSCSI server."),
        (status = 422, description = "The logout request failed."),
    )
)]
async fn logout_node(
    State(state): State<ISCSIState<'_>>,
    Path(id): Path<u32>,
) -> Result<impl IntoResponse, Error> {
    if state.client.logout(id).await? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::UNPROCESSABLE_ENTITY)
    }
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct DiscoverParams {
    /// iSCSI server address.
    address: String,
    /// iSCSI service port.
    port: u32,
    /// Authentication options.
    #[serde(default)]
    options: ISCSIAuth,
}

/// Performs an iSCSI discovery.
#[utoipa::path(
    post,
    path="/discover",
    context_path="/api/storage/iscsi",
    responses(
        (status = 204, description = "The iSCSI discovery request was successful."),
        (status = 400, description = "The iSCSI discovery request failed."),
    )
)]
async fn discover(
    State(state): State<ISCSIState<'_>>,
    Json(params): Json<DiscoverParams>,
) -> Result<impl IntoResponse, Error> {
    let result = state
        .client
        .discover(&params.address, params.port, params.options)
        .await?;
    if result {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Ok(StatusCode::BAD_REQUEST)
    }
}
