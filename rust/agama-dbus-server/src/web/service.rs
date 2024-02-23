use super::{auth::TokenClaims, config::ServiceConfig, state::ServiceState, EventsSender};
use axum::{
    extract::Request,
    middleware,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use std::convert::Infallible;
use tower::Service;
use tower_http::trace::TraceLayer;

pub struct MainServiceBuilder {
    config: ServiceConfig,
    events: EventsSender,
    router: Router<ServiceState>,
}

impl MainServiceBuilder {
    pub fn new(events: EventsSender) -> Self {
        let router = Router::new().route("/ws", get(super::ws::ws_handler));
        let config = ServiceConfig::default();

        Self {
            events,
            router,
            config,
        }
    }

    pub fn with_config(self, config: ServiceConfig) -> Self {
        Self { config, ..self }
    }

    pub fn add_service<T>(self, path: &str, service: T) -> Self
    where
        T: Service<Request, Error = Infallible> + Clone + Send + 'static,
        T::Response: IntoResponse,
        T::Future: Send + 'static,
    {
        Self {
            router: self.router.nest_service(path, service),
            ..self
        }
    }

    pub fn build(self) -> Router {
        let state = ServiceState {
            config: self.config,
            events: self.events,
        };
        self.router
            .route_layer(middleware::from_extractor_with_state::<TokenClaims, _>(
                state.clone(),
            ))
            .route("/ping", get(super::http::ping))
            .route("/authenticate", post(super::http::authenticate))
            .layer(TraceLayer::new_for_http())
            .with_state(state)
    }
}
