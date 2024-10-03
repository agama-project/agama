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

#[derive(Clone)]
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
        let default_client = reqwest::Client::new();

        Self {
            client: reqwest::Client::builder()
                .danger_accept_invalid_certs(true)
                .build().unwrap_or(default_client),
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
            .map_err(anyhow::Error::new)?;

        headers.insert(header::AUTHORIZATION, value);

        let client = reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .default_headers(headers)
            .build()?;
        Ok(client)
    }

    fn url(&self, path: &str) -> String {
        self.base_url.clone() + path
    }

    /// Simple wrapper around [`Response`] to get object from response.
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    pub async fn get<T>(&self, path: &str) -> Result<T, ServiceError>
    where
        T: DeserializeOwned,
    {
        let response: Result<_, ServiceError> = self
            .client
            .get(self.url(path))
            .send()
            .await
            .map_err(|e| e.into());
        self.deserialize_or_error(response?).await
    }

    pub async fn post<T>(&self, path: &str, object: &impl Serialize) -> Result<T, ServiceError>
    where
        T: DeserializeOwned,
    {
        let response = self
            .request_response(reqwest::Method::POST, path, object)
            .await?;
        self.deserialize_or_error(response).await
    }

    /// post object to given path and report error if response is not success
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn post_void(&self, path: &str, object: &impl Serialize) -> Result<(), ServiceError> {
        let response = self
            .request_response(reqwest::Method::POST, path, object)
            .await?;
        self.unit_or_error(response).await
    }

    /// put object to given path, deserializes the response
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/users/first`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn put<T>(&self, path: &str, object: &impl Serialize) -> Result<T, ServiceError>
    where
        T: DeserializeOwned,
    {
        let response = self
            .request_response(reqwest::Method::PUT, path, object)
            .await?;
        self.deserialize_or_error(response).await
    }

    /// put object to given path and report error if response is not success
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/users/first`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn put_void(&self, path: &str, object: &impl Serialize) -> Result<(), ServiceError> {
        let response = self
            .request_response(reqwest::Method::PUT, path, object)
            .await?;
        self.unit_or_error(response).await
    }

    /// patch object at given path and report error if response is not success
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/users/first`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    pub async fn patch<T>(&self, path: &str, object: &impl Serialize) -> Result<T, ServiceError>
    where
        T: DeserializeOwned,
    {
        let response = self
            .request_response(reqwest::Method::PATCH, path, object)
            .await?;
        self.deserialize_or_error(response).await
    }

    pub async fn patch_void(
        &self,
        path: &str,
        object: &impl Serialize,
    ) -> Result<(), ServiceError> {
        let response = self
            .request_response(reqwest::Method::PATCH, path, object)
            .await?;
        self.unit_or_error(response).await
    }

    /// delete call on given path and report error if failed
    ///
    /// Arguments:
    ///
    /// * `path`: path relative to HTTP API like `/questions/1`    
    pub async fn delete_void(&self, path: &str) -> Result<(), ServiceError> {
        let response: Result<_, ServiceError> = self
            .client
            .delete(self.url(path))
            .send()
            .await
            .map_err(|e| e.into());
        self.unit_or_error(response?).await
    }

    /// POST/PUT/PATCH an object to a given path and returns server response.
    /// Reports Err only if failed to send
    /// request, but if server returns e.g. 500, it will be in Ok result.
    ///
    /// In general unless specific response handling is needed, simple post should be used.
    ///
    /// Arguments:
    ///
    /// * `method`: for example `reqwest::Method::PUT`
    /// * `path`: path relative to HTTP API like `/questions`
    /// * `object`: Object that can be serialiazed to JSON as body of request.
    async fn request_response(
        &self,
        method: reqwest::Method,
        path: &str,
        object: &impl Serialize,
    ) -> Result<Response, ServiceError> {
        self.client
            .request(method, self.url(path))
            .json(object)
            .send()
            .await
            .map_err(|e| e.into())
    }

    /// Return deserialized JSON body as `Ok(T)` or an `Err` with [`ServiceError::BackendError`]
    async fn deserialize_or_error<T>(&self, response: Response) -> Result<T, ServiceError>
    where
        T: DeserializeOwned,
    {
        // DEBUG: This dbg is nice but it omits the body, thus we try harder below
        // let response = dbg!(response);

        if response.status().is_success() {
            // We'd like to simply:
            //     response.json::<T>().await.map_err(|e| e.into())
            // BUT also peek into the response text, in case something is wrong
            // so this copies the implementation from the above and adds a debug part

            let bytes_r: Result<_, ServiceError> = response.bytes().await.map_err(|e| e.into());
            let bytes = bytes_r?;

            // DEBUG: (we expect JSON so dbg! would escape too much, eprintln! is better)
            // let text = String::from_utf8_lossy(&bytes);
            // eprintln!("Response body: {}", text);

            serde_json::from_slice(&bytes).map_err(|e| e.into())
        } else {
            Err(self.build_backend_error(response).await)
        }
    }

    /// Return `Ok(())` or an `Err` with [`ServiceError::BackendError`]
    async fn unit_or_error(&self, response: Response) -> Result<(), ServiceError> {
        if response.status().is_success() {
            Ok(())
        } else {
            Err(self.build_backend_error(response).await)
        }
    }

    const NO_TEXT: &'static str = "(Failed to extract error text from HTTP response)";
    /// Builds [`ServiceError::BackendError`] from response.
    ///
    /// It contains also processing of response body, that is why it has to be async.
    ///
    /// Arguments:
    ///
    /// * `response`: response from which generate error
    async fn build_backend_error(&self, response: Response) -> ServiceError {
        let code = response.status().as_u16();
        let text = response
            .text()
            .await
            .unwrap_or_else(|_| Self::NO_TEXT.to_string());
        ServiceError::BackendError(code, text)
    }
}
