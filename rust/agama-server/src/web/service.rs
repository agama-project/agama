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

use super::http::{login, login_from_query, logout, session};
use super::{config::ServiceConfig, state::ServiceState, EventsSender};
use agama_lib::auth::TokenClaims;
use axum::{
    body::Body,
    extract::Request,
    middleware,
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use std::time::Duration;
use std::{
    convert::Infallible,
    path::{Path, PathBuf},
};
use tower::Service;
use tower_http::{compression::CompressionLayer, services::ServeDir, trace::TraceLayer};
use tracing::Span;

/// Builder for Agama main service.
///
/// It is responsible for building an axum service which includes:
///
/// * A static assets directory (`public_dir`).
/// * A websocket at the `/ws` path.
/// * An authentication endpoint at `/auth`.
/// * A 'ping' endpoint at '/ping'.
/// * A number of authenticated services that are added using the `add_service` function.
pub struct MainServiceBuilder {
    config: ServiceConfig,
    events: EventsSender,
    api_router: Router<ServiceState>,
    public_dir: PathBuf,
}

impl MainServiceBuilder {
    /// Returns a new service builder.
    ///
    /// * `events`: channel to send events through the WebSocket.
    /// * `public_dir`: path to the public directory.
    pub fn new<P>(events: EventsSender, public_dir: P) -> Self
    where
        P: AsRef<Path>,
    {
        let api_router = Router::new().route("/ws", get(super::ws::ws_handler));
        let config = ServiceConfig::default();

        Self {
            events,
            api_router,
            config,
            public_dir: PathBuf::from(public_dir.as_ref()),
        }
    }

    pub fn with_config(self, config: ServiceConfig) -> Self {
        Self { config, ..self }
    }

    /// Add an authenticated service.
    ///
    /// * `path`: Path to mount the service under `/api`.
    /// * `service`: Service to mount on the given `path`.
    pub fn add_service<T>(self, path: &str, service: T) -> Self
    where
        T: Service<Request, Error = Infallible> + Clone + Send + 'static,
        T::Response: IntoResponse,
        T::Future: Send + 'static,
    {
        Self {
            api_router: self.api_router.nest_service(path, service),
            ..self
        }
    }

    pub fn build(self) -> Router {
        let state = ServiceState {
            config: self.config,
            events: self.events,
            public_dir: self.public_dir.clone(),
        };

        let api_router = self
            .api_router
            .route_layer(middleware::from_extractor_with_state::<TokenClaims, _>(
                state.clone(),
            ))
            .route("/ping", get(super::http::ping))
            .route("/auth", post(login).get(session).delete(logout));

        tracing::info!("Serving static files from {}", self.public_dir.display());
        let serve = ServeDir::new(self.public_dir).precompressed_gzip();

        Router::new()
            .nest_service("/", serve)
            .route("/login", get(login_from_query))
            .route("/po.js", get(super::http::po))
            .nest("/api", api_router)
            .layer(
                TraceLayer::new_for_http()
                    .on_request(|request: &Request<Body>, _span: &Span| {
                        tracing::info!("request: {} {}", request.method(), request.uri().path())
                    })
                    .on_response(
                        |response: &Response<Body>, latency: Duration, _span: &Span| {
                            tracing::info!("response: {} {:?}", response.status(), latency)
                        },
                    ),
            )
            .layer(CompressionLayer::new().br(true))
            .with_state(state)
    }
}
