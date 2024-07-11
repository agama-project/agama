//! This module implements the web API for the questions module.
//!
//! The module offers two public functions:
//!
//! * `questions_service` which returns the Axum service.
//! * `questions_stream` which offers an stream that emits questions related signals.

use crate::{error::Error, web::Event};
use agama_lib::{
    error::ServiceError,
    proxies::{GenericQuestionProxy, QuestionWithPasswordProxy, Questions1Proxy}, questions::model::{Answer, GenericQuestion, PasswordAnswer, Question, QuestionWithPassword},
};
use anyhow::Context;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{delete, get},
    Json, Router,
};
use regex::Regex;
use std::{collections::HashMap, pin::Pin};
use tokio_stream::{Stream, StreamExt};
use zbus::{
    fdo::ObjectManagerProxy,
    names::{InterfaceName, OwnedInterfaceName},
    zvariant::{ObjectPath, OwnedObjectPath},
};

// TODO: move to lib or maybe not and just have in lib client for http API?
#[derive(Clone)]
struct QuestionsClient<'a> {
    connection: zbus::Connection,
    objects_proxy: ObjectManagerProxy<'a>,
    questions_proxy: Questions1Proxy<'a>,
}

impl<'a> QuestionsClient<'a> {
    pub async fn new(dbus: zbus::Connection) -> Result<Self, zbus::Error> {
        let question_path =
            OwnedObjectPath::from(ObjectPath::try_from("/org/opensuse/Agama1/Questions")?);
        Ok(Self {
            connection: dbus.clone(),
            questions_proxy: Questions1Proxy::new(&dbus).await?,
            objects_proxy: ObjectManagerProxy::builder(&dbus)
                .path(question_path)?
                .destination("org.opensuse.Agama1")?
                .build()
                .await?,
        })
    }

    pub async fn create_question(&self, question: Question) -> Result<Question, ServiceError> {
        // TODO: ugly API is caused by dbus method to create question. It can be changed in future as DBus is internal only API
        let generic = &question.generic;
        let options: Vec<&str> = generic.options.iter().map(String::as_ref).collect();
        let data: HashMap<&str, &str> = generic
            .data
            .iter()
            .map(|(k, v)| (k.as_str(), v.as_str()))
            .collect();
        let path = if question.with_password.is_some() {
            self.questions_proxy
                .new_with_password(
                    &generic.class,
                    &generic.text,
                    &options,
                    &generic.default_option,
                    data,
                )
                .await?
        } else {
            self.questions_proxy
                .new_question(
                    &generic.class,
                    &generic.text,
                    &options,
                    &generic.default_option,
                    data,
                )
                .await?
        };
        let mut res = question.clone();
        // we are sure that regexp is correct, so use unwrap
        let id_matcher = Regex::new(r"/(?<id>\d+)$").unwrap();
        let Some(id_cap) = id_matcher.captures(path.as_str()) else {
            let msg = format!("Failed to get ID for new question: {}", path.as_str()).to_string();
            return Err(ServiceError::UnsuccessfulAction(msg));
        }; // TODO: better error if path does not contain id
        res.generic.id = id_cap["id"].parse::<u32>().unwrap();
        Ok(question)
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
                result.push(self.build_question_with_password(path).await?)
            } else {
                result.push(self.build_generic_question(path).await?)
            }
        }
        Ok(result)
    }

    async fn build_generic_question(
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

    async fn build_question_with_password(
        &self,
        path: &OwnedObjectPath,
    ) -> Result<Question, ServiceError> {
        let mut result = self.build_generic_question(path).await?;
        result.with_password = Some(QuestionWithPassword {});

        Ok(result)
    }

    pub async fn delete(&self, id: u32) -> Result<(), ServiceError> {
        let question_path = ObjectPath::from(
            ObjectPath::try_from(format!("/org/opensuse/Agama1/Questions/{}", id))
                .context("Failed to create dbus path")?,
        );

        self.questions_proxy
            .delete(&question_path)
            .await
            .map_err(|e| e.into())
    }

    pub async fn get_answer(&self, id: u32) -> Result<Option<Answer>, ServiceError> {
        let question_path = OwnedObjectPath::from(
            ObjectPath::try_from(format!("/org/opensuse/Agama1/Questions/{}", id))
                .context("Failed to create dbus path")?,
        );
        let mut result = Answer::default();
        let dbus_password_res = QuestionWithPasswordProxy::builder(&self.connection)
            .path(&question_path)?
            .cache_properties(zbus::CacheProperties::No)
            .build()
            .await;
        if let Ok(dbus_password) = dbus_password_res {
            result.with_password = Some(PasswordAnswer {
                password: dbus_password.password().await?,
            });
        }

        let dbus_generic = GenericQuestionProxy::builder(&self.connection)
            .path(&question_path)?
            .cache_properties(zbus::CacheProperties::No)
            .build()
            .await?;
        let answer = dbus_generic.answer().await?;
        if answer.is_empty() {
            Ok(None)
        } else {
            result.generic.answer = answer;
            Ok(Some(result))
        }
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

/// Sets up and returns the axum service for the questions module.
pub async fn questions_service(dbus: zbus::Connection) -> Result<Router, ServiceError> {
    let questions = QuestionsClient::new(dbus.clone()).await?;
    let state = QuestionsState { questions };
    let router = Router::new()
        .route("/", get(list_questions).post(create_question))
        .route("/:id", delete(delete_question))
        .route("/:id/answer", get(get_answer).put(answer_question))
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

/// Get answer to question.
///
/// * `state`: service state.
/// * `questions_id`: id of question
#[utoipa::path(put, path = "/questions/:id/answer", responses(
    (status = 200, description = "Answer"),
    (status = 400, description = "The D-Bus service could not perform the action"),
    (status = 404, description = "Answer was not yet provided"),
))]
async fn get_answer(
    State(state): State<QuestionsState<'_>>,
    Path(question_id): Path<u32>,
) -> Result<Response, Error> {
    let res = state.questions.get_answer(question_id).await?;
    if let Some(answer) = res {
        Ok(Json(answer).into_response())
    } else {
        Ok(StatusCode::NOT_FOUND.into_response())
    }
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
async fn answer_question(
    State(state): State<QuestionsState<'_>>,
    Path(question_id): Path<u32>,
    Json(answer): Json<Answer>,
) -> Result<(), Error> {
    let res = state.questions.answer(question_id, answer).await;
    Ok(res?)
}

/// Deletes question.
///
/// * `state`: service state.
/// * `questions_id`: id of question
#[utoipa::path(delete, path = "/questions/:id", responses(
    (status = 200, description = "question deleted"),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn delete_question(
    State(state): State<QuestionsState<'_>>,
    Path(question_id): Path<u32>,
) -> Result<(), Error> {
    let res = state.questions.delete(question_id).await;
    Ok(res?)
}

/// Create new question.
///
/// * `state`: service state.
/// * `question`: struct with question where id of question is ignored and will be assigned
#[utoipa::path(post, path = "/questions", responses(
    (status = 200, description = "answer question"),
    (status = 400, description = "The D-Bus service could not perform the action")
))]
async fn create_question(
    State(state): State<QuestionsState<'_>>,
    Json(question): Json<Question>,
) -> Result<Json<Question>, Error> {
    let res = state.questions.create_question(question).await?;
    Ok(Json(res))
}
