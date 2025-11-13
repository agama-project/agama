// Copyright (c) [2025] SUSE LLC
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

use std::{process::Command, sync::Arc};

use crate::{
    message,
    model::{software_selection::SoftwareSelection, state::SoftwareState, ModelAdapter},
    zypp_server::{self, SoftwareAction},
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event::{self, Event},
        software::{Config, Proposal, Repository, SoftwareProposal, SystemInfo},
        Issue, IssueSeverity, Scope,
    },
    issue,
    products_registry::ProductSpec,
    progress,
};
use async_trait::async_trait;
use tokio::sync::{broadcast, Mutex, RwLock};

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("software service could not send the event")]
    Event(#[from] broadcast::error::SendError<Event>),
    #[error(transparent)]
    Actor(#[from] actor::Error),
    #[error("Failed to send message to libzypp thread: {0}")]
    ZyppSender(#[from] tokio::sync::mpsc::error::SendError<SoftwareAction>),
    #[error("Failed to receive result from libzypp thread: {0}")]
    ZyppReceiver(#[from] tokio::sync::oneshot::error::RecvError),
    #[error(transparent)]
    IO(#[from] std::io::Error),
    #[error("There is no proposal for software")]
    MissingProposal,
    #[error("There is no product selected")]
    MissingProduct,
    #[error("There is no {0} product")]
    WrongProduct(String),
    #[error(transparent)]
    ZyppServerError(#[from] zypp_server::ZyppServerError),
    #[error(transparent)]
    ZyppError(#[from] zypp_agama::errors::ZyppError),
}

/// Localization service.
///
/// It is responsible for handling the localization part of the installation:
///
/// * Reads the list of known locales, keymaps and timezones.
/// * Keeps track of the localization settings of the underlying system (the installer).
/// * Holds the user configuration.
/// * Applies the user configuration at the end of the installation.
pub struct Service {
    model: Arc<Mutex<dyn ModelAdapter + Send + 'static>>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    events: event::Sender,
    state: State,
    selection: SoftwareSelection,
}

#[derive(Default)]
struct State {
    config: Config,
    system: SystemInfo,
    proposal: Arc<RwLock<Proposal>>,
}

impl Service {
    pub fn new<T: ModelAdapter>(
        model: T,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        events: event::Sender,
    ) -> Service {
        Self {
            model: Arc::new(Mutex::new(model)),
            issues,
            progress,
            events,
            state: Default::default(),
            selection: Default::default(),
        }
    }

    pub async fn setup(&mut self) -> Result<(), Error> {
        if let Some(install_repo) = find_install_repository() {
            tracing::info!("Found repository at {}", install_repo.url);
            self.state.system.repositories.push(install_repo);
        }
        Ok(())
    }

    async fn update_system(&mut self) -> Result<(), Error> {
        // TODO: add system information (repositories, patterns, etc.).
        self.events.send(Event::SystemChanged {
            scope: Scope::Software,
        })?;

        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.state.system.clone())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        Ok(self.state.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<Config>) -> Result<(), Error> {
        let product = message.product.read().await;

        self.state.config = message.config.clone().unwrap_or_default();
        self.events.send(Event::ConfigChanged {
            scope: Scope::Software,
        })?;

        let software = SoftwareState::build_from(
            &product,
            &self.state.config,
            &self.state.system,
            &self.selection,
        );
        tracing::info!("Wanted software state: {software:?}");

        let model = self.model.clone();
        let issues = self.issues.clone();
        let events = self.events.clone();
        let progress = self.progress.clone();
        let proposal = self.state.proposal.clone();
        let product_spec = product.clone();
        tokio::task::spawn(async move {
            let (new_proposal, found_issues) =
                match compute_proposal(model, product_spec, software, progress).await {
                    Ok((new_proposal, found_issues)) => (Some(new_proposal), found_issues),
                    Err(error) => {
                        let new_issue = Issue::new(
                            "software.proposal_failed",
                            "It was not possible to create a software proposal",
                            IssueSeverity::Error,
                        )
                        .with_details(&error.to_string());
                        (None, vec![new_issue])
                    }
                };
            proposal.write().await.software = new_proposal;
            _ = issues.cast(issue::message::Set::new(Scope::Software, found_issues));
            _ = events.send(Event::ProposalChanged {
                scope: Scope::Software,
            });
        });

        Ok(())
    }
}

async fn compute_proposal(
    model: Arc<Mutex<dyn ModelAdapter + Send + 'static>>,
    product_spec: ProductSpec,
    wanted: SoftwareState,
    progress: Handler<progress::Service>,
) -> Result<(SoftwareProposal, Vec<Issue>), Error> {
    let mut my_model = model.lock().await;
    my_model.set_product(product_spec);
    let issues = my_model.write(wanted, progress).await?;
    let proposal = my_model.compute_proposal().await?;
    Ok((proposal, issues))
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        Ok(self.state.proposal.read().await.clone().into_option())
    }
}

#[async_trait]
impl MessageHandler<message::Refresh> for Service {
    async fn handle(&mut self, _message: message::Refresh) -> Result<(), Error> {
        self.model.lock().await.refresh().await?;
        self.update_system().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::Install> for Service {
    async fn handle(&mut self, _message: message::Install) -> Result<bool, Error> {
        self.model.lock().await.install().await
    }
}

#[async_trait]
impl MessageHandler<message::Finish> for Service {
    async fn handle(&mut self, _message: message::Finish) -> Result<(), Error> {
        self.model.lock().await.finish().await?;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetResolvables> for Service {
    async fn handle(&mut self, message: message::SetResolvables) -> Result<(), Error> {
        self.selection.set(&message.id, message.resolvables);
        Ok(())
    }
}

const LIVE_REPO_DIR: &str = "/run/initramfs/live/install";

fn find_install_repository() -> Option<Repository> {
    if !std::fs::exists(LIVE_REPO_DIR).is_ok_and(|e| e) {
        return None;
    }

    normalize_repository_url(LIVE_REPO_DIR, "/install").map(|url| Repository {
        alias: "install".to_string(),
        name: "install".to_string(),
        url,
        enabled: true,
        mandatory: true,
    })
}

fn normalize_repository_url(mount_point: &str, path: &str) -> Option<String> {
    let live_device = Command::new("findmnt")
        .args(["-o", "SOURCE", "--noheadings", "--target", mount_point])
        .output()
        .ok()?;
    let live_device = String::from_utf8(live_device.stdout)
        .map(|d| d.trim().to_string())
        .ok()?;

    // check against /\A/dev/sr[0-9]+\z/
    if live_device.starts_with("/dev/sr") {
        return Some(format!("dvd:{path}?devices={live_device}"));
    }

    let by_id_devices = Command::new("find")
        .args(["-L", "/dev/disk/by-id", "-samefile", &live_device])
        .output()
        .ok()?;
    let by_id_devices = String::from_utf8(by_id_devices.stdout).ok()?;
    let mut by_id_devices = by_id_devices.trim().split("\n");

    let device = by_id_devices.next().unwrap_or_default();
    if device.is_empty() {
        Some(format!("hd:{mount_point}?device={live_device}"))
    } else {
        Some(format!("hd:{mount_point}?device={device}"))
    }
}
