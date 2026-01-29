// Copyright (c) [2025] SUSE LLC
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

//! This module implements Agama's HTTP API.

use crate::server::config_schema;
use agama_lib::{error::ServiceError, logs};
use agama_manager::service::Error as ManagerError;
use agama_manager::{self as manager, message};
use agama_software::Resolvable;
use agama_utils::{
    actor::Handler,
    api::{
        event,
        manager::LicenseContent,
        query,
        question::{Question, QuestionSpec, UpdateQuestion},
        Action, Config, IssueWithScope, Patch, Status, SystemInfo,
    },
    progress, question,
};
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::HeaderValue,
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use hyper::{header, HeaderMap, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio_util::io::ReaderStream;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Manager(#[from] manager::service::Error),
    #[error(transparent)]
    Questions(#[from] question::service::Error),
    #[error(transparent)]
    ConfigSchema(#[from] config_schema::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        tracing::warn!("Server return error {}", self);
        let body = json!({
            "error": self.to_string()
        });

        let mut status = StatusCode::BAD_REQUEST;

        if let Error::Manager(error) = &self {
            if matches!(error, ManagerError::PendingIssues { issues: _ })
                || matches!(error, ManagerError::Busy { scopes })
            {
                status = StatusCode::UNPROCESSABLE_ENTITY;
            }
        }

        (status, Json(body)).into_response()
    }
}

#[derive(Clone)]
pub struct ServerState {
    manager: Handler<manager::Service>,
    questions: Handler<question::Service>,
}

impl ServerState {
    pub fn new(manager: Handler<manager::Service>, questions: Handler<question::Service>) -> Self {
        Self { manager, questions }
    }
}

type ServerResult<T> = Result<T, Error>;

/// Sets up and returns the axum service for the manager module
///
/// * `events`: channel to send events to the websocket.
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///   that require to connect to the Agama's D-Bus server won't work.
pub async fn server_service(
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<Router, ServiceError> {
    let questions = question::start(events.clone())
        .await
        .map_err(anyhow::Error::msg)?;
    let manager = manager::Service::starter(questions.clone(), events, dbus)
        .start()
        .await
        .map_err(anyhow::Error::msg)?;
    let state = ServerState::new(manager, questions);
    server_with_state(state)
}
pub fn server_with_state(state: ServerState) -> Result<Router, ServiceError> {
    Ok(Router::new()
        .route("/status", get(get_status))
        .route("/system", get(get_system))
        .route("/extended_config", get(get_extended_config))
        .route(
            "/config",
            get(get_config).put(put_config).patch(patch_config),
        )
        .route("/proposal", get(get_proposal))
        .route("/action", post(run_action))
        .route("/issues", get(get_issues))
        .route(
            "/questions",
            get(get_questions).post(ask_question).patch(update_question),
        )
        .route("/licenses/:id", get(get_license))
        .route(
            "/private/storage_model",
            get(get_storage_model).put(set_storage_model),
        )
        .route("/private/solve_storage_model", get(solve_storage_model))
        .route("/private/resolvables/:id", put(set_resolvables))
        .route("/private/download_logs", get(download_logs))
        .with_state(state))
}

#[utoipa::path(
    get,
    path = "/status",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Status of the installation."),
        (status = 400, description = "Not possible to retrieve the status of the installation.")
    )
)]
async fn get_status(State(state): State<ServerState>) -> ServerResult<Json<Status>> {
    let status = state.manager.call(progress::message::GetStatus).await?;
    Ok(Json(status))
}

/// Returns the information about the system.
#[utoipa::path(
    get,
    path = "/system",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "System information."),
        (status = 400, description = "Not possible to retrieve the system information.")
    )
)]
async fn get_system(State(state): State<ServerState>) -> ServerResult<Json<SystemInfo>> {
    let system = state.manager.call(message::GetSystem).await?;
    Ok(Json(system))
}

/// Returns the extended configuration.
#[utoipa::path(
    get,
    path = "/extended_config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Extended configuration"),
        (status = 400, description = "Not possible to retrieve the configuration.")
    )
)]
async fn get_extended_config(State(state): State<ServerState>) -> ServerResult<Json<Config>> {
    let config = state.manager.call(message::GetExtendedConfig).await?;
    Ok(Json(config))
}

/// Returns the configuration.
#[utoipa::path(
    get,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Configuration."),
        (status = 400, description = "Not possible to retrieve the configuration.")
    )
)]
async fn get_config(State(state): State<ServerState>) -> ServerResult<Json<Config>> {
    let config = state.manager.call(message::GetConfig).await?;
    Ok(Json(config))
}

/// Updates the configuration.
///
/// Replaces the whole configuration. If some value is missing, it will be removed.
#[utoipa::path(
    put,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was replaced. Other operations can be running in background."),
        (status = 400, description = "Not possible to replace the configuration.")
    ),
    params(
        ("config" = Value, description = "Configuration to apply.")
    )
)]
async fn put_config(State(state): State<ServerState>, Json(json): Json<Value>) -> ServerResult<()> {
    config_schema::check(&json)?;
    let config = serde_json::from_value(json)?;
    state.manager.call(message::SetConfig::new(config)).await?;
    Ok(())
}

/// Patches the configuration.
///
/// It only changes the specified values, keeping the rest as they are.
#[utoipa::path(
    patch,
    path = "/config",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The configuration was patched. Other operations can be running in background."),
        (status = 400, description = "Not possible to patch the configuration.")
    ),
    params(
        ("patch" = Patch, description = "Changes in the configuration.")
    )
)]
async fn patch_config(
    State(state): State<ServerState>,
    Json(patch): Json<Patch>,
) -> ServerResult<()> {
    if let Some(json) = patch.update {
        config_schema::check(&json)?;
        let config = serde_json::from_value(json)?;
        state
            .manager
            .call(message::UpdateConfig::new(config))
            .await?;
    }
    Ok(())
}

/// Returns how the target system is configured (proposal).
#[utoipa::path(
    get,
    path = "/proposal",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Proposal successfully retrieved."),
        (status = 400, description = "Not possible to retrieve the proposal.")
    )
)]
async fn get_proposal(State(state): State<ServerState>) -> ServerResult<Response> {
    let proposal = state.manager.call(message::GetProposal).await?;
    Ok(to_option_response(proposal))
}

/// Returns the list of issues.
#[utoipa::path(
    get,
    path = "/issues",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama issues", body = Vec<IssueWithScope>),
        (status = 400, description = "Not possible to retrieve the issues")
    )
)]
async fn get_issues(State(state): State<ServerState>) -> ServerResult<Json<Vec<IssueWithScope>>> {
    let issue_groups = state.manager.call(message::GetIssues).await?;

    let issues = issue_groups
        .into_iter()
        .flat_map(|(scope, issues)| -> Vec<IssueWithScope> {
            issues
                .into_iter()
                .map(|issue| IssueWithScope { scope, issue })
                .collect()
        })
        .collect();

    Ok(Json(issues))
}

/// Returns the issues for each scope.
#[utoipa::path(
    get,
    path = "/questions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Agama questions", body = HashMap<u32, QuestionSpec>),
        (status = 400, description = "Not possible to retrieve the questions")
    )
)]
async fn get_questions(State(state): State<ServerState>) -> ServerResult<Json<Vec<Question>>> {
    let questions = state.questions.call(question::message::Get).await?;
    Ok(Json(questions))
}

/// Registers a new question.
#[utoipa::path(
    post,
    path = "/questions",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "New question's ID", body = u32),
        (status = 400, description = "Not possible to register the question")
    )
)]
async fn ask_question(
    State(state): State<ServerState>,
    Json(question): Json<QuestionSpec>,
) -> ServerResult<Json<Question>> {
    let question = state
        .questions
        .call(question::message::Ask::new(question))
        .await?;
    Ok(Json(question))
}

/// Updates the question collection by answering or removing a question.
#[utoipa::path(
    patch,
    path = "/questions",
    context_path = "/api/v2",
    request_body = UpdateQuestion,
    responses(
        (status = 200, description = "The question was answered or deleted"),
        (status = 400, description = "It was not possible to update the question")
    )
)]
async fn update_question(
    State(state): State<ServerState>,
    Json(operation): Json<UpdateQuestion>,
) -> ServerResult<()> {
    match operation {
        UpdateQuestion::Answer { id, answer } => {
            state
                .questions
                .call(question::message::Answer { id, answer })
                .await?;
        }
        UpdateQuestion::Delete { id } => {
            state
                .questions
                .call(question::message::Delete { id })
                .await?;
        }
    }
    Ok(())
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
async fn get_license(
    State(state): State<ServerState>,
    Path(id): Path<String>,
    Query(query): Query<LicenseQuery>,
) -> Result<Response, Error> {
    let lang = query.lang.unwrap_or("en".to_string());

    let Ok(lang) = lang.as_str().try_into() else {
        return Ok(StatusCode::BAD_REQUEST.into_response());
    };

    let license = state
        .manager
        .call(message::GetLicense::new(id.to_string(), lang))
        .await?;
    if let Some(license) = license {
        Ok(Json(license).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
}

#[utoipa::path(
    post,
    path = "/action",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Action successfully ran."),
        (status = 400, description = "Not possible to run the action.", body = Object),
        (status = 422, description = "Action blocked by backend state", body = Object)
    ),
    params(
        ("action" = Action, description = "Description of the action to run."),
    )
)]
async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<Action>,
) -> ServerResult<()> {
    state.manager.call(message::RunAction::new(action)).await?;
    Ok(())
}

/// Returns how the target system is configured (proposal).
#[utoipa::path(
    get,
    path = "/private/storage_model",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Storage model was successfully retrieved."),
        (status = 400, description = "Not possible to retrieve the storage model.")
    )
)]
async fn get_storage_model(State(state): State<ServerState>) -> ServerResult<Json<Option<Value>>> {
    let model = state.manager.call(message::GetStorageModel).await?;
    Ok(Json(model))
}

#[utoipa::path(
    put,
    request_body = String,
    path = "/private/storage_model",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "Set the storage model"),
        (status = 400, description = "Not possible to set the storage model")
    )
)]
async fn set_storage_model(
    State(state): State<ServerState>,
    Json(model): Json<Value>,
) -> ServerResult<()> {
    state
        .manager
        .call(message::SetStorageModel::new(model))
        .await?;
    Ok(())
}

/// Solves a storage config model.
#[utoipa::path(
    get,
    path = "/private/solve_storage_model",
    context_path = "/api/v2",
    params(query::SolveStorageModel),
    responses(
        (status = 200, description = "Solve the storage model", body = String),
        (status = 400, description = "Not possible to solve the storage model")
    )
)]
async fn solve_storage_model(
    State(state): State<ServerState>,
    Query(params): Query<query::SolveStorageModel>,
) -> Result<Json<Option<Value>>, Error> {
    let solved_model = state
        .manager
        .call(message::SolveStorageModel::new(params.model))
        .await?;
    Ok(Json(solved_model))
}

#[utoipa::path(
    put,
    path = "/resolvables/:id",
    context_path = "/api/v2",
    responses(
        (status = 200, description = "The resolvables list was updated.")
    )
)]
async fn set_resolvables(
    State(state): State<ServerState>,
    Path(id): Path<String>,
    Json(resolvables): Json<Vec<Resolvable>>,
) -> ServerResult<()> {
    state
        .manager
        .cast(agama_software::message::SetResolvables::new(
            id,
            resolvables,
        ))?;
    Ok(())
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Solves a storage config model.
#[utoipa::path(
    get,
    path = "/private/download_logs",
    context_path = "/api/v2",
    params(query::SolveStorageModel),
    responses(
        (status = 200, description = "Compressed Agama logs", content_type="application/octet-stream", body = String),
        (status = 500, description = "Cannot collect the logs"),
        (status = 507, description = "Server is probably out of space"),
    )
)]
async fn download_logs() -> impl IntoResponse {
    let mut headers = HeaderMap::new();
    let err_response = (headers.clone(), Body::empty());

    match logs::store() {
        Ok(path) => {
            if let Ok(file) = tokio::fs::File::open(path.clone()).await {
                let stream = ReaderStream::new(file);
                let body = Body::from_stream(stream);
                let _ = std::fs::remove_file(path.clone());

                // See RFC2046, RFC2616 and
                // https://www.iana.org/assignments/media-types/media-types.xhtml
                // or /etc/mime.types
                headers.insert(
                    header::CONTENT_TYPE,
                    HeaderValue::from_static("application/x-compressed-tar"),
                );
                if let Some(file_name) = path.file_name() {
                    let disposition =
                        format!("attachment; filename=\"{}\"", &file_name.to_string_lossy());
                    headers.insert(
                        header::CONTENT_DISPOSITION,
                        HeaderValue::from_str(&disposition)
                            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
                    );
                }
                headers.insert(
                    header::CONTENT_ENCODING,
                    HeaderValue::from_static(logs::DEFAULT_COMPRESSION.1),
                );

                (StatusCode::OK, (headers, body))
            } else {
                (StatusCode::INSUFFICIENT_STORAGE, err_response)
            }
        }
        Err(_) => (StatusCode::INTERNAL_SERVER_ERROR, err_response),
    }
}
