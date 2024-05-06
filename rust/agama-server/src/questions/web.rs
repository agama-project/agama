//! This module implements the web API for the questions module.
//!
//! The module offers two public functions:
//!
//! * `questions_service` which returns the Axum service.
//! * `questions_stream` which offers an stream that emits questions related signals.

use crate::{error::Error, web::Event};
use agama_lib::{
    error::ServiceError,
    proxies::{GenericQuestionProxy, QuestionWithPasswordProxy},
};
use anyhow::Context;
use axum::{
    extract::{Path, State},
    routing::{get, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, pin::Pin};
use tokio_stream::{Stream, StreamExt};
use zbus::{
    fdo::ObjectManagerProxy,
    names::{InterfaceName, OwnedInterfaceName},
    zvariant::{ObjectPath, OwnedObjectPath},
};

// TODO: move to lib
#[derive(Clone)]
struct QuestionsClient<'a> {
    connection: zbus::Connection,
    objects_proxy: ObjectManagerProxy<'a>,
}

impl<'a> QuestionsClient<'a> {
    pub async fn new(dbus: zbus::Connection) -> Result<Self, zbus::Error> {
        let question_path =
            OwnedObjectPath::from(ObjectPath::try_from("/org/opensuse/Agama1/Questions")?);
        Ok(Self {
            connection: dbus.clone(),
            objects_proxy: ObjectManagerProxy::builder(&dbus)
                .path(question_path)?
                .destination("org.opensuse.Agama1")?
                .build()
                .await?,
        })
    }

    pub async fn questions(&self) -> Result<Vec<Question>, ServiceError> {
        let objects = self
            .objects_proxy
            .get_managed_objects()
            .await
            .context("failed to get managed object with Object Manager")?;
        let mut result: Vec<Question> = Vec::with_capacity(objects.len());
        let password_interface = OwnedInterfaceName::from(
            InterfaceName::from_static_str("org.opensuse.Agama1.Questions.WithPassword")
                .context("Failed to create interface name for question with password")?,
        );
        for (path, interfaces_hash) in objects.iter() {
            if interfaces_hash.contains_key(&password_interface) {
                result.push(self.create_question_with_password(path).await?)
            } else {
                result.push(self.create_generic_question(path).await?)
            }
        }
        Ok(result)
    }

    async fn create_generic_question(
        &self,
        path: &OwnedObjectPath,
    ) -> Result<Question, ServiceError> {
        let dbus_question = GenericQuestionProxy::builder(&self.connection)
            .path(path)?
            .cache_properties(zbus::CacheProperties::No)
            .build()
            .await?;
        let result = Question {
            generic: GenericQuestion {
                id: dbus_question.id().await?,
                class: dbus_question.class().await?,
                text: dbus_question.text().await?,
                options: dbus_question.options().await?,
                default_option: dbus_question.default_option().await?,
                data: dbus_question.data().await?,
            },
            with_password: None,
        };

        Ok(result)
    }

    async fn create_question_with_password(
        &self,
        path: &OwnedObjectPath,
    ) -> Result<Question, ServiceError> {
        let dbus_question = QuestionWithPasswordProxy::builder(&self.connection)
            .path(path)?
            .cache_properties(zbus::CacheProperties::No)
            .build()
            .await?;
        let mut result = self.create_generic_question(path).await?;
        result.with_password = Some(QuestionWithPassword {
            password: dbus_question.password().await?,
        });

        Ok(result)
    }

    pub async fn answer(&self, id: u32, answer: Answer) -> Result<(), ServiceError> {
        let question_path = OwnedObjectPath::from(
            ObjectPath::try_from(format!("/org/opensuse/Agama1/Questions/{}", id))
                .context("Failed to create dbus path")?,
        );
        if let Some(password) = answer.with_password {
            let dbus_password = QuestionWithPasswordProxy::builder(&self.connection)
                .path(&question_path)?
                .cache_properties(zbus::CacheProperties::No)
                .build()
                .await?;
            dbus_password
                .set_password(password.password.as_str())
                .await?
        }
        let dbus_generic = GenericQuestionProxy::builder(&self.connection)
            .path(&question_path)?
            .cache_properties(zbus::CacheProperties::No)
            .build()
            .await?;
        dbus_generic
            .set_answer(answer.generic.answer.as_str())
            .await?;
        Ok(())
    }
}

#[derive(Clone)]
struct QuestionsState<'a> {
    questions: QuestionsClient<'a>,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    generic: GenericQuestion,
    with_password: Option<QuestionWithPassword>,
}

/// Facade of agama_lib::questions::GenericQuestion
/// For fields details see it.
/// Reason why it does not use directly GenericQuestion from lib
/// is that it contain both question and answer. It works for dbus
/// API which has both as attributes, but web API separate
/// question and its answer. So here it is split into GenericQuestion
/// and GenericAnswer
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GenericQuestion {
    id: u32,
    class: String,
    text: String,
    options: Vec<String>,
    default_option: String,
    data: HashMap<String, String>,
}

/// Facade of agama_lib::questions::WithPassword
/// For fields details see it.
/// Reason why it does not use directly WithPassword from lib
/// is that it is not composition as used here, but more like
/// child of generic question and contain reference to Base.
/// Here for web API we want to have in json that separation that would
/// allow to compose any possible future specialization of question
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct QuestionWithPassword {
    password: String,
}

#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Answer {
    generic: GenericAnswer,
    with_password: Option<PasswordAnswer>,
}

/// Answer needed for GenericQuestion
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GenericAnswer {
    answer: String,
}

/// Answer needed for Password specific questions.
#[derive(Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PasswordAnswer {
    password: String,
}

/// Sets up and returns the axum service for the questions module.
pub async fn questions_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let questions = QuestionsClient::new(dbus.clone()).await?;
    let state = QuestionsState { questions };
    let router = Router::new()
        .route("/", get(list_questions))
        .route("/:id/answer", put(answer))
        .with_state(state);
    Ok(router)
}

pub async fn questions_stream(
    dbus: zbus::Connection,
) -> Result<Pin<Box<dyn Stream<Item = Event> + Send>>, Error> {
    let question_path = OwnedObjectPath::from(
        ObjectPath::try_from("/org/opensuse/Agama1/Questions")
            .context("failed to create object path")?,
    );
    let proxy = ObjectManagerProxy::builder(&dbus)
        .path(question_path)
        .context("Failed to create object manager path")?
        .destination("org.opensuse.Agama1")?
        .build()
        .await
        .context("Failed to create Object MAnager proxy")?;
    let add_stream = proxy
        .receive_interfaces_added()
        .await?
        .then(|_| async move { Event::QuestionsChanged });
    let remove_stream = proxy
        .receive_interfaces_removed()
        .await?
        .then(|_| async move { Event::QuestionsChanged });
    let stream = StreamExt::merge(add_stream, remove_stream);
    Ok(Box::pin(stream))
}

/// Returns the list of questions that waits for answer.
///
/// * `state`: service state.
#[utoipa::path(get, path = "/questions", responses(
    (status = 200, description = "List of open questions", body = Vec<Question>),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn list_questions(
    State(state): State<QuestionsState<'_>>,
) -> Result<Json<Vec<Question>>, Error> {
    Ok(Json(state.questions.questions().await?))
}

/// Provide answer to question.
///
/// * `state`: service state.
/// * `questions_id`: id of question
/// * `answer`: struct with answer and possible other data needed for answer like password
#[utoipa::path(put, path = "/questions/:id/answer", responses(
    (status = 200, description = "answer question"),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn answer(
    State(state): State<QuestionsState<'_>>,
    Path(question_id): Path<u32>,
    Json(answer): Json<Answer>,
) -> Result<(), Error> {
    state.questions.answer(question_id, answer).await?;
    Ok(())
}
