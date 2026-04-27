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
use crate::web::error::ErrorResponse;
use agama_lib::{error::ServiceError, logs};
use agama_manager::service::Error as ManagerError;
use agama_manager::users::PasswordCheckResult;
use agama_manager::{self as manager, message, users};
use agama_software::Resolvable;
use agama_utils::{
    actor::Handler,
    api::{
        event,
        manager::LicenseContent,
        query,
        question::{Question, QuestionSpec, UpdateQuestion},
        Action, Config, IssueWithScope, Patch, Proposal, Status, SystemInfo,
    },
    progress, question,
};
use aide::axum::routing::{get_with, post_with, put};
use aide::axum::ApiRouter;
use aide::transform::TransformOperation;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::HeaderValue,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json,
};
use hyper::{header, HeaderMap, StatusCode};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;
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
    #[error("Missing language tag")]
    MissingLanguageTag,
}

impl Error {
    /// Creates a BAD_REQUEST (400) response from this error.
    fn bad_request(self) -> Response {
        ErrorResponse::bad_request(self)
    }

    /// Creates an INTERNAL_SERVER_ERROR (500) response from this error.
    fn internal_server_error(self) -> Response {
        ErrorResponse::internal_server_error(self)
    }

    /// Creates an UNPROCESSABLE_ENTITY (422) response from this error.
    fn unprocessable_entity(self) -> Response {
        ErrorResponse::unprocessable_entity(self)
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

// Handlers return Response directly for errors so they can choose the appropriate status code

/// Sets up and returns the axum service for the manager module
///
/// * `events`: channel to send events to the websocket.
/// * `dbus`: connection to Agama's D-Bus server. If it is not given, those features
///   that require to connect to the Agama's D-Bus server won't work.
pub async fn server_service(
    events: event::Sender,
    dbus: zbus::Connection,
) -> Result<ApiRouter, ServiceError> {
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

/// Sets up and returns the axum service for the manager module with the given state
///
/// * `state`: server state.
pub fn server_with_state(state: ServerState) -> Result<ApiRouter, ServiceError> {
    Ok(ApiRouter::new()
        .api_route("/status", get_with(get_status, get_status_docs))
        .api_route("/system", get_with(get_system, get_system_docs))
        .api_route(
            "/extended_config",
            get_with(get_extended_config, get_extended_config_docs),
        )
        .api_route(
            "/config",
            get_with(get_config, get_config_docs)
                .put_with(put_config, put_config_docs)
                .patch_with(patch_config, patch_config_docs),
        )
        .api_route("/proposal", get_with(get_proposal, get_proposal_docs))
        .api_route("/action", post_with(run_action, run_action_docs))
        .api_route("/issues", get_with(get_issues, get_issues_docs))
        .api_route(
            "/questions",
            get_with(get_questions, get_questions_docs)
                .post_with(ask_question, ask_question_docs)
                .patch_with(update_question, update_question_docs),
        )
        .api_route("/licenses/{id}", get_with(get_license, get_license_docs))
        .route("/resolvables/{id}", put(set_resolvables))
        .route(
            "/private/storage_model",
            get(get_storage_model).put(set_storage_model),
        )
        .route("/private/solve_storage_model", get(solve_storage_model))
        .route("/private/download_logs", get(download_logs))
        .route("/private/password_check", post(check_password))
        .with_state(state))
}

async fn get_status(State(state): State<ServerState>) -> Result<Json<Status>, Response> {
    let status = state
        .manager
        .call(progress::message::GetStatus)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(status))
}

fn get_status_docs(op: TransformOperation) -> TransformOperation {
    op.id("getInstallerStatus")
        .summary("Get installer status")
        .description(
            "Returns the current status of the installation process, including the current \
            stage and the progress of the ongoing actions. This endpoint can be polled to monitor \
            installation progress.",
        )
        .tag("System & Monitoring")
        .response_with::<200, Json<Status>, _>(|res| res.description("Status of the installation"))
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns the information about the system.
async fn get_system(State(state): State<ServerState>) -> Result<Json<SystemInfo>, Response> {
    let system = state
        .manager
        .call(message::GetSystem)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(system))
}

fn get_system_docs(op: TransformOperation) -> TransformOperation {
    op.id("getSystemInfo")
        .summary("Get system information")
        .description(
            "Returns detailed information about the installation system including hardware \
            details, platform information, and system capabilities. It includes Agama specific \
            information like the list of available products for installation.",
        )
        .tag("System & Monitoring")
        .response_with::<200, Json<SystemInfo>, _>(|res| {
            res.description("System information retrieved successfully")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns the extended configuration.
async fn get_extended_config(State(state): State<ServerState>) -> Result<Json<Config>, Response> {
    let config = state
        .manager
        .call(message::GetExtendedConfig)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(config))
}

fn get_extended_config_docs(op: TransformOperation) -> TransformOperation {
    op.id("getExtendedConfiguration")
        .summary("Get extended configuration")
        .description(
            "Returns the extended configuration including computed defaults and \
            system-generated values. Use this endpoint to see the complete configuration \
            including values not explicitly set by the user.",
        )
        .tag("Configuration")
        .response_with::<200, Json<Config>, _>(|res| {
            res.description("Extended configuration retrieved successfully")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns the configuration.
async fn get_config(State(state): State<ServerState>) -> Result<Json<Config>, Response> {
    let config = state
        .manager
        .call(message::GetConfig)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(config))
}

fn get_config_docs(op: TransformOperation) -> TransformOperation {
    op.id("getConfiguration")
        .summary("Get configuration")
        .description("Returns the current user-defined configuration.")
        .tag("Configuration")
        .response_with::<200, Json<Config>, _>(|res| {
            res.description("Configuration retrieved successfully")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Updates the configuration.
///
/// Replaces the whole configuration. If some value is missing, it will be removed.
async fn put_config(
    State(state): State<ServerState>,
    Json(json): Json<Value>,
) -> Result<(), Response> {
    // Schema validation errors and JSON parsing errors are client errors (400)
    config_schema::check(&json).map_err(|e| Error::from(e).bad_request())?;
    let config = serde_json::from_value(json).map_err(|e| Error::from(e).bad_request())?;
    // Manager errors are internal server errors (500)
    state
        .manager
        .call(message::SetConfig::new(config))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

fn put_config_docs(op: TransformOperation) -> TransformOperation {
    op.id("updateConfiguration")
        .summary("Update configuration")
        .description(
            "Replaces the entire configuration. Any fields not included in the request \
            will be removed from the configuration. For partial updates, use PATCH instead. \
            The request body should be a JSON object conforming to the Config schema.",
        )
        .tag("Configuration")
        .input::<Json<Config>>() // Override the auto-detected Json<Value> with Config schema
        .response::<200, ()>()
        .response_with::<400, Json<ErrorResponse>, _>(|res| {
            res.description("Invalid configuration schema or malformed JSON")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Patches the configuration.
///
/// It only changes the specified values, keeping the rest as they are.
async fn patch_config(
    State(state): State<ServerState>,
    Json(patch): Json<Patch>,
) -> Result<(), Response> {
    if let Some(json) = patch.update {
        // Schema validation errors and JSON parsing errors are client errors (400)
        config_schema::check(&json).map_err(|e| Error::from(e).bad_request())?;
        let config = serde_json::from_value(json).map_err(|e| Error::from(e).bad_request())?;
        // Manager errors are internal server errors (500)
        state
            .manager
            .call(message::UpdateConfig::new(config))
            .await
            .map_err(|e| Error::from(e).internal_server_error())?;
    }
    Ok(())
}

fn patch_config_docs(op: TransformOperation) -> TransformOperation {
    op.id("patchConfiguration")
        .summary("Patch configuration")
        .description(
            "Partially updates the configuration. Only the specified fields will be changed, \
            all other fields remain unchanged. This is the preferred method for making \
            incremental configuration changes.",
        )
        .tag("Configuration")
        .response::<200, ()>()
        .response_with::<400, Json<ErrorResponse>, _>(|res| {
            res.description("Invalid configuration schema or malformed JSON")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns how the target system is configured (proposal).
async fn get_proposal(State(state): State<ServerState>) -> Result<Response, Response> {
    let proposal = state
        .manager
        .call(message::GetProposal)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(to_option_response(proposal))
}

fn get_proposal_docs(op: TransformOperation) -> TransformOperation {
    op.id("getInstallationProposal")
        .summary("Get installation proposal")
        .description(
            "Returns the proposed configuration for the target system. The proposal is \
            generated based on the current configuration and represents how the system \
            will be configured when installed.",
        )
        .tag("Configuration")
        .response_with::<200, Json<Proposal>, _>(|res| {
            res.description("Proposal successfully retrieved")
        })
        .response::<404, ()>()
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns the list of issues.
async fn get_issues(
    State(state): State<ServerState>,
) -> Result<Json<Vec<IssueWithScope>>, Response> {
    let issue_groups = state
        .manager
        .call(message::GetIssues)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;

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

fn get_issues_docs(op: TransformOperation) -> TransformOperation {
    op.id("listIssues")
        .summary("List issues")
        .description(
            "Returns the list of all current issues detected during the installation process. \
            Issues represent problems or warnings that may need to be addressed before \
            proceeding with the installation.",
        )
        .tag("Issues & Questions")
        .response_with::<200, Json<Vec<IssueWithScope>>, _>(|res| {
            res.description("List of issues with their scopes")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns the issues for each scope.
async fn get_questions(State(state): State<ServerState>) -> Result<Json<Vec<Question>>, Response> {
    let questions = state
        .questions
        .call(question::message::Get)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(questions))
}

fn get_questions_docs(op: TransformOperation) -> TransformOperation {
    op.id("listQuestions")
        .summary("List questions")
        .description(
            "Returns all pending questions that require user input. Questions represent \
            interactive prompts where the installer needs additional information or \
            decisions from the user.",
        )
        .tag("Issues & Questions")
        .response_with::<200, Json<Vec<Question>>, _>(|res| {
            res.description("List of pending questions")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Registers a new question.
async fn ask_question(
    State(state): State<ServerState>,
    Json(question): Json<QuestionSpec>,
) -> Result<Json<Question>, Response> {
    let question = state
        .questions
        .call(question::message::Ask::new(question))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(question))
}

fn ask_question_docs(op: TransformOperation) -> TransformOperation {
    op.id("createQuestion")
        .summary("Create question")
        .description(
            "Registers a new question for user interaction. The question will be added to \
            the list of pending questions and can be answered or deleted later.",
        )
        .tag("Issues & Questions")
        .response_with::<200, Json<Question>, _>(|res| {
            res.description("Question created successfully")
        })
        .response_with::<400, Json<ErrorResponse>, _>(|res| res.description("Malformed JSON"))
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Updates the question collection by answering or removing a question.
async fn update_question(
    State(state): State<ServerState>,
    Json(operation): Json<UpdateQuestion>,
) -> Result<(), Response> {
    match operation {
        UpdateQuestion::Answer { id, answer } => {
            state
                .questions
                .call(question::message::Answer { id, answer })
                .await
                .map_err(|e| Error::from(e).internal_server_error())?;
        }
        UpdateQuestion::Delete { id } => {
            state
                .questions
                .call(question::message::Delete { id })
                .await
                .map_err(|e| Error::from(e).internal_server_error())?;
        }
    }
    Ok(())
}

fn update_question_docs(op: TransformOperation) -> TransformOperation {
    op.id("updateQuestion")
        .summary("Update question")
        .description(
            "Updates the question collection by answering or removing a question. Use this \
            endpoint to provide an answer to a pending question or to dismiss it.",
        )
        .tag("Issues & Questions")
        .response::<200, ()>()
        .response_with::<400, Json<ErrorResponse>, _>(|res| res.description("Malformed JSON"))
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

#[derive(Deserialize, JsonSchema)]
struct LicenseQuery {
    /// License language
    lang: Option<String>,
}

#[derive(Deserialize, JsonSchema)]
#[schemars(inline)]
// Needed by aide to document path params (see https://github.com/tamasfe/aide/discussions/281).
struct LicenseParams {
    /// License identifier (e.g., "license.final")
    id: String,
}

/// Returns the license content.
///
/// Optionally it can receive a language tag (RFC 5646). Otherwise, it returns
/// the license in English.
async fn get_license(
    State(state): State<ServerState>,
    Path(license): Path<LicenseParams>,
    Query(query): Query<LicenseQuery>,
) -> Result<Response, Response> {
    let lang = query.lang.unwrap_or("en".to_string());
    let lang = lang
        .as_str()
        .try_into()
        .map_err(|_| Error::MissingLanguageTag.bad_request())?;

    let license = state
        .manager
        .call(message::GetLicense::new(license.id.to_string(), lang))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    if let Some(license) = license {
        Ok(Json(license).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
}

fn get_license_docs(op: TransformOperation) -> TransformOperation {
    op.id("getLicenseById")
        .summary("Get license by ID")
        .description(
            "Returns the content of a specific license. Optionally accepts a language tag \
            (RFC 5646) via the 'lang' query parameter. If no language is specified, the \
            license is returned in English.",
        )
        .tag("System & Monitoring")
        .response_with::<200, Json<LicenseContent>, _>(|res| {
            res.description("License retrieved successfully")
        })
        .response_with::<400, Json<ErrorResponse>, _>(|res| {
            res.description("The specified language tag is not valid")
        })
        .response::<404, ()>()
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

async fn run_action(
    State(state): State<ServerState>,
    Json(action): Json<Action>,
) -> Result<(), Response> {
    // RunAction can fail with PendingIssues or Busy errors (422) or other errors (500)
    state
        .manager
        .call(message::RunAction::new(action))
        .await
        .map_err(|error| match &error {
            ManagerError::PendingIssues { .. } | ManagerError::Busy { .. } => {
                Error::from(error).unprocessable_entity()
            }
            _ => Error::from(error).internal_server_error(),
        })?;
    Ok(())
}

fn run_action_docs(op: TransformOperation) -> TransformOperation {
    op.id("executeAction")
        .summary("Execute action")
        .description(
            "Executes an installation action such as starting the installation process or \
            probing hardware. Some actions may be blocked if there are pending issues or \
            if the system is busy.",
        )
        .tag("Actions")
        .response::<200, ()>()
        .response_with::<422, Json<ErrorResponse>, _>(|res| {
            res.description("Action blocked by backend state (e.g., pending issues or system busy)")
        })
        .response_with::<500, Json<ErrorResponse>, _>(|res| {
            res.description("Internal server error")
        })
}

/// Returns how the target system is configured (proposal).
async fn get_storage_model(
    State(state): State<ServerState>,
) -> Result<Json<Option<Value>>, Response> {
    let model = state
        .manager
        .call(message::GetStorageModel)
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(model))
}

async fn set_storage_model(
    State(state): State<ServerState>,
    Json(model): Json<Value>,
) -> Result<(), Response> {
    state
        .manager
        .call(message::SetStorageModel::new(model))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

/// Solves a storage config model.
async fn solve_storage_model(
    State(state): State<ServerState>,
    Query(params): Query<query::SolveStorageModel>,
) -> Result<Json<Option<Value>>, Response> {
    let solved_model = state
        .manager
        .call(message::SolveStorageModel::new(params.model))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(solved_model))
}

async fn set_resolvables(
    State(state): State<ServerState>,
    Path(id): Path<String>,
    Json(resolvables): Json<Vec<Resolvable>>,
) -> Result<(), Response> {
    state
        .manager
        .cast(agama_software::message::SetResolvables::new(
            id,
            resolvables,
        ))
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(())
}

fn to_option_response<T: Serialize>(value: Option<T>) -> Response {
    match value {
        Some(inner) => Json(inner).into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

/// Solves a storage config model.
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

#[derive(Deserialize, JsonSchema)]
pub struct PasswordParams {
    password: String,
}

async fn check_password(
    State(state): State<ServerState>,
    Json(password): Json<PasswordParams>,
) -> Result<Json<PasswordCheckResult>, Response> {
    let result = state
        .manager
        .call(users::message::CheckPassword::new(password.password))
        .await
        .map_err(|e| Error::from(e).internal_server_error())?;
    Ok(Json(result))
}
