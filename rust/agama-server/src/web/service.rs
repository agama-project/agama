use super::http::{login, logout, session};
use super::{auth::TokenClaims, config::ServiceConfig, state::ServiceState, EventsSender};
use axum::{
    body::Body,
    extract::Request,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use axum_extra::extract::cookie::CookieJar;
use std::{
    convert::Infallible,
    path::{Path, PathBuf},
};
use tower::Service;
use tower_http::{compression::CompressionLayer, services::ServeDir, trace::TraceLayer};

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
        };

        let api_router = self
            .api_router
            .route_layer(middleware::from_extractor_with_state::<TokenClaims, _>(
                state.clone(),
            ))
            .route("/ping", get(super::http::ping))
            .route("/auth", post(login).get(session).delete(logout));

        let serve = ServeDir::new(self.public_dir);

        // handle the /po.js request
        // the requested language (locale) is sent in the "agamaLanguage" HTTP cookie
        // this reimplements the Cockpit translation support
        async fn po(jar: CookieJar) -> impl IntoResponse {
            let mut response_headers = HeaderMap::new();

            if let Some(cookie) = jar.get("agamaLanguage") {
                let mut target_file = String::new();
                let mut found = false;
                // FIXME: this does not work, the public_dir setting is not accessible :-/
                // when using something like PathBuf::from("/usr/share/cockpit/agama") here
                // it works just fine....
                let prefix = self.public_dir;

                // try parsing the cookie
                if let Some((lang, region)) = cookie.value().split_once('-') {
                    // first try the full locale
                    target_file = format!("po.{}_{}.js", lang, region.to_uppercase());
                    found = prefix.join(&target_file).exists();

                    if !found {
                        // then try the language only
                        target_file = format!("po.{}.js", lang);
                        found = prefix.join(&target_file).exists();
                    }
                }

                if !found {
                    // use the full cookie without parsing
                    target_file = format!("po.{}.js", cookie.value());
                    found = prefix.join(&target_file).exists();
                }

                if found {
                    // translation found, redirect to the real file
                    response_headers.insert(
                        header::LOCATION,
                        // if the file exists then the name is a valid header value and unwrapping is safe
                        HeaderValue::from_str(&target_file).unwrap()
                    );

                    return (StatusCode::TEMPORARY_REDIRECT, response_headers, Body::empty())
                }
            }

            // fallback, return empty javascript translations if the language is not supported
            response_headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/javascript"),
            );

            (StatusCode::OK, response_headers, Body::empty())
        }

        Router::new()
            .nest_service("/", serve)
            .route("/po.js", get(po))
            .nest("/api", api_router)
            .layer(TraceLayer::new_for_http())
            .layer(CompressionLayer::new().br(true))
            .with_state(state)
    }
}
