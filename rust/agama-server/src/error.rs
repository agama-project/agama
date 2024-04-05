use agama_lib::error::ServiceError;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::{l10n::LocaleError, questions::QuestionsError};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("D-Bus error: {0}")]
    DBus(#[from] zbus::Error),
    #[error("Generic error: {0}")]
    Anyhow(String),
    #[error("Agama service error: {0}")]
    Service(#[from] ServiceError),
    #[error("Questions service error: {0}")]
    Questions(QuestionsError),
    #[error("Software service error: {0}")]
    Locale(#[from] LocaleError),
}

// This would be nice, but using it for a return type
// results in a confusing error message about
// error[E0277]: the trait bound `MyError: Serialize` is not satisfied
//type MyResult<T> = Result<T, MyError>;

impl From<anyhow::Error> for Error {
    fn from(e: anyhow::Error) -> Self {
        // {:#} includes causes
        Self::Anyhow(format!("{:#}", e))
    }
}

impl From<Error> for zbus::fdo::Error {
    fn from(value: Error) -> zbus::fdo::Error {
        zbus::fdo::Error::Failed(format!("D-Bus error: {value}"))
    }
}

impl IntoResponse for Error {
    fn into_response(self) -> Response {
        let body = json!({
            "error": self.to_string()
        });
        (StatusCode::BAD_REQUEST, Json(body)).into_response()
    }
}
