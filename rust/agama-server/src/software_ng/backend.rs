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

//! Implements the logic for the software service.
//!
//! This service is responsible for the software management of the installer. The service uses
//! Tokio's tasks for long-running operations (e.g., when reading the repositories). However, only
//! one of those operations can run at the same time. It works in this way by design, not because of
//! a technical limitation.
//!
//! A service is composed of two parts: the server and the client. The server handles the business
//! logic and receives the actions to execute using a channel. The client is a simple wrapper around
//! the other end of the channel.
//!
//! Additionally, a service might implement a monitor which listens for events and talks to the
//! server when needed.

use std::sync::Arc;

use agama_lib::http::event;
pub use client::SoftwareServiceClient;
use tokio::sync::{mpsc, oneshot, Mutex};
use zypp_agama::ZyppError;

use crate::products::ProductsRegistry;

mod client;
mod server;

type SoftwareActionSender = tokio::sync::mpsc::UnboundedSender<server::SoftwareAction>;

#[derive(thiserror::Error, Debug)]
pub enum SoftwareServiceError {
    #[error("Response channel closed")]
    ResponseChannelClosed,

    #[error("Receiver error: {0}")]
    RecvError(#[from] oneshot::error::RecvError),

    #[error("Sender error: {0}")]
    SendError(#[from] mpsc::error::SendError<server::SoftwareAction>),

    #[error("Unknown product: {0}")]
    UnknownProduct(String),

    #[error("Target creation failed: {0}")]
    TargetCreationFailed(#[source] std::io::Error),

    #[error("No selected product")]
    NoSelectedProduct,

    #[error("Failed to initialize target directory: {0}")]
    TargetInitFailed(#[source] ZyppError),

    #[error("Failed to add a repository: {0}")]
    AddRepositoryFailed(#[source] ZyppError),

    #[error("Failed to load the repositories: {0}")]
    LoadSourcesFailed(#[source] ZyppError),

    #[error("Listing patterns failed: {0}")]
    ListPatternsFailed(#[source] ZyppError),

    #[error("Error from libzypp: {0}")]
    ZyppError(#[from] zypp_agama::ZyppError),
}

pub type SoftwareServiceResult<R> = Result<R, SoftwareServiceError>;

/// Builds and starts the software service.
///
pub struct SoftwareService {}

impl SoftwareService {
    /// Starts the software service.
    pub fn start(
        events: event::Sender,
        products: Arc<Mutex<ProductsRegistry>>,
    ) -> Result<SoftwareServiceClient, SoftwareServiceError> {
        server::SoftwareServiceServer::start(events, products)
    }
}
