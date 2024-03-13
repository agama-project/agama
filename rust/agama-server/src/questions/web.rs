//! This module implements the web API for the software module.
//!
//! The module offers two public functions:
//!
//! * `questions_service` which returns the Axum service.
//! * `questions_stream` which offers an stream that emits questions related signals.

use std::collections::HashMap;
use crate::{error::Error, web::Event};
use agama_lib::{
    error::ServiceError, proxies::Questions1Proxy,
};
use axum::{
    extract::{State, Path},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, put},
    Json, Router,
};
use tokio_stream::{Stream, StreamExt};
use zbus::fdo::ObjectManagerProxy;
use thiserror::Error;
use serde::{Deserialize, Serialize};
use serde_json::json;

// TODO: move to lib
#[derive(Clone)]
struct QuestionsClient<'a> {
    connection: zbus::Connection,
    questions_proxy: Questions1Proxy<'a>,
    objects_proxy: ObjectManagerProxy<'a>,
}

impl<'a> QuestionsClient<'a> {
    pub async fn new(dbus: zbus::Connection) -> Result<Self, zbus::Error> {
        Ok(Self {
            connection: dbus.clone(),
            questions_proxy: Questions1Proxy::new(&dbus).await?,
            objects_proxy: ObjectManagerProxy::new(&dbus).await?
        })
    }

    pub async fn questions(self) -> Result<Vec<Question>, ServiceError> {
        // TODO: real call to dbus
        Ok(vec![])
    }
}

#[derive(Error, Debug)]
pub enum QuestionsError {
    #[error("Question service error: {0}")]
    Error(#[from] ServiceError),
}

impl IntoResponse for QuestionsError {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}

#[derive(Clone)]
struct QuestionsState<'a> {
    questions: QuestionsClient<'a>,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Question {
    generic: GenericQuestion,
    with_password: Option<QuestionWithPassword>,
}

/// Facade of agama_lib::questions::GenericQuestion
/// For fields details see it.
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct GenericQuestion {
    id: u32,
    class: String,
    text: String,
    options: Vec<String>,
    default_option: String,
    data: HashMap<String, String>
}

/// Facade of agama_lib::questions::WithPassword
/// For fields details see it.
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct QuestionWithPassword {
    password: String
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Answer {
    generic: GenericAnswer,
    with_password: Option<PasswordAnswer>,
}

/// Answer needed for GenericQuestion
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct GenericAnswer {
    answer: String
}

/// Answer needed for Password specific questions.
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PasswordAnswer {
    password: String
}
/// Sets up and returns the axum service for the questions module.
pub async fn questions_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let questions = QuestionsClient::new(dbus.clone()).await?;
    let state = QuestionsState { questions };
    let router = Router::new()
        .route("/questions", get(list_questions))
        .route("/questions/:id/answer", put(answer))
        .with_state(state);
    Ok(router)
}

pub async fn questions_stream(dbus: zbus::Connection) -> Result<impl Stream<Item = Event>, Error> {
    let proxy = ObjectManagerProxy::new(&dbus).await?;
    let add_stream = proxy
        .receive_interfaces_added()
        .await?
        .then(|_| async move {
            Event::QuestionsChanged
        });
    let remove_stream = proxy
        .receive_interfaces_removed()
        .await?
        .then(|_| async move {
            Event::QuestionsChanged
        });
    Ok(StreamExt::merge(add_stream, remove_stream))
}

async fn list_questions(State(state): State<QuestionsState<'_>>
    ) -> Result<Json<Vec<Question>>, QuestionsError> {
  Ok(Json(state.questions.questions().await?))
}

async fn answer(
State(state): State<QuestionsState<'_>>,
Path(question_id): Path<u32>,
Json(answer): Json<Answer>
) -> Result<(), QuestionsError> {
    //TODO: real answer
    Ok(())
}