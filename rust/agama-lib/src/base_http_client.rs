use reqwest::{header, Response};
use serde::{de::DeserializeOwned, Serialize};

use crate::{auth::AuthToken, error::ServiceError};

/// Base that all HTTP clients should use.
///
/// It provides several features including automatic base URL switching,
/// websocket events listening or object constructions.
///
/// Usage should be just thin layer in domain specific client.
///
/// ```no_run
///   use agama_lib::questions::model::Question;
///   use agama_lib::base_http_client::BaseHTTPClient;
///   use agama_lib::error::ServiceError;
///
///   async fn get_questions() -> Result<Vec<Question>, ServiceError> {
///     let client = BaseHTTPClient::new()?;
///     client.get("/questions").await
///   }
/// ```
pub struct BaseHTTPClient {
    client: reqwest::Client,
    pub base_url: String,
}

const API_URL: &str = "http://localhost/api";

impl Default for BaseHTTPClient {
    /// A `default` client
    /// - is NOT authenticated (maybe you want to call `new` instead)
    /// - uses `localhost`
    fn default() -> Self {
        Self {
            client: reqwest::Client::new(),
            base_url: API_URL.to_owned(),
        }
    }
}

impl BaseHTTPClient {
    /// Uses `localhost`, authenticates with [`AuthToken`].
    pub fn new() -> Result<Self, ServiceError> {
        Ok(Self {
            client: Self::authenticated_client()?,
            ..Default::default()
        })
    }

    fn authenticated_client() -> Result<reqwest::Client, ServiceError> {
        // TODO: this error is subtly misleading, leading me to believe the SERVER said it,
        // but in fact it is the CLIENT not finding an auth token
        let token = AuthToken::find().ok_or(ServiceError::NotAuthenticated)?;

        let mut headers = header::HeaderMap::new();
        // just use generic anyhow error here as Bearer format is constructed by us, so failures can come only from token
        let value = header::HeaderValue::from_str(format!("Bearer {}", token).as_str())
            .map_err(|e| anyhow::Error::new(e))?;

        headers.insert(header::AUTHORIZATION, value);

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .build()?;
        Ok(client)
    }

    /// Simple wrapper around [`Response`] to get object from response.
    ///
    /// If a complete [`Response`] is needed, use the [`Self::get_response`] method.
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    pub async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, ServiceError> {
        let response = self.get_response(path).await?;
        if response.status().is_success() {
            response.json::<T>().await.map_err(|e| e.into())
        } else {
            Err(self.build_backend_error(response).await)
        }
    }

    /// Calls GET method on the given path and returns [`Response`] that can be further
    /// processed.
    ///
    /// If only simple object from JSON is required, use method get.
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    pub async fn get_response(&self, path: &str) -> Result<Response, ServiceError> {
        self.client
            .get(self.url(path))
            .send()
            .await
            .map_err(|e| e.into())
    }

    fn url(&self, path: &str) -> String {
        self.base_url.clone() + path
    }

    /// post object to given path and report error if response is not success
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn post(&self, path: &str, object: &impl Serialize) -> Result<(), ServiceError> {
        let response = self.post_response(path, object).await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(self.build_backend_error(response).await)
        }
    }

    /// post object to given path and returns server response. Reports error only if failed to send
    /// request, but if server returns e.g. 500, it will be in Ok result.
    ///
    /// In general unless specific response handling is needed, simple post should be used.
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn post_response(
        &self,
        path: &str,
        object: &impl Serialize,
    ) -> Result<Response, ServiceError> {
        self.client
            .post(self.url(path))
            .json(object)
            .send()
            .await
            .map_err(|e| e.into())
    }

    /// delete call on given path and report error if failed
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions/1`    
    pub async fn delete(&self, path: &str) -> Result<(), ServiceError> {
        let response = self.delete_response(path).await?;
        if response.status().is_success() {
            Ok(())
        } else {
            Err(self.build_backend_error(response).await)
        }
    }

    /// delete call on given path and returns server response. Reports error only if failed to send
    /// request, but if server returns e.g. 500, it will be in Ok result.
    ///
    /// In general unless specific response handling is needed, simple delete should be used.
    /// TODO: do not need variant with request body? if so, then create additional method.
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions/1`    
    pub async fn delete_response(&self, path: &str) -> Result<Response, ServiceError> {
        self.client
            .delete(self.url(path))
            .send()
            .await
            .map_err(|e| e.into())
    }

    const NO_TEXT: &'static str = "(Failed to extract error text from HTTP response)";
    /// Builds [`BackendError`] from response.
    ///
    /// It contains also processing of response body, that is why it has to be async.
    ///
    /// Arguments:
    ///
    /// * `response`: response from which generate error
    pub async fn build_backend_error(&self, response: Response) -> ServiceError {
        let code = response.status().as_u16();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| Self::NO_TEXT.to_string());
        ServiceError::BackendError(code, text)
    }
}
