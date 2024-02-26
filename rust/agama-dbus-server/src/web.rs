//! This module implements a web-based API for Agama. It is responsible for:
//!
//! * Exposing an HTTP API to interact with Agama.
//! * Emit relevant events via websocket.
//! * Serve the code for the web user interface (not implemented yet).

mod auth;
mod config;
mod docs;
mod http;
mod service;
mod state;
mod ws;

pub use auth::generate_token;
pub use config::ServiceConfig;
pub use docs::ApiDoc;
pub use service::service;
