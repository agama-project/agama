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

use crate::{
    message,
    model::{software_selection::SoftwareSelection, state::SoftwareState, ModelAdapter},
    zypp_server::{self, SoftwareAction, ZyppServer},
    Model,
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event::{self, Event},
        software::{Config, Proposal, Repository, SoftwareProposal, SystemInfo},
        Issue, Scope,
    },
    issue,
    products::ProductSpec,
    progress, question,
};
use async_trait::async_trait;
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::Arc,
};
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

/// Starts the software service.
pub struct Starter {
    model: Option<Arc<Mutex<dyn ModelAdapter + Send + 'static>>>,
    events: event::Sender,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    questions: Handler<question::Service>,
}

impl Starter {
    pub fn new(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
    ) -> Self {
        Self {
            model: None,
            events,
            issues,
            progress,
            questions,
        }
    }

    /// Use the given model.
    ///
    /// By default, the software service relies on libzypp (through the zypp-agama crate).
    /// However, it might be useful to replace it in some scenarios (e.g., when testing).
    ///
    /// * `model`: model to use. It must implement the [ModelAdapter] trait.
    pub fn with_model<T: ModelAdapter + Send + 'static>(mut self, model: T) -> Self {
        self.model = Some(Arc::new(Mutex::new(model)));
        self
    }

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let model = match self.model {
            Some(model) => model,
            None => {
                let zypp_sender = ZyppServer::start()?;
                Arc::new(Mutex::new(Model::new(
                    zypp_sender,
                    find_mandatory_repositories("/"),
                    self.progress.clone(),
                    self.questions.clone(),
                )?))
            }
        };

        let state = Arc::new(RwLock::new(Default::default()));
        let mut service = Service {
            model,
            selection: Default::default(),
            state,
            events: self.events,
            issues: self.issues,
            progress: self.progress,
        };
        service.setup().await?;
        Ok(actor::spawn(service))
    }
}

/// Software service.
///
/// It is responsible for handling the software part of the installation:
///
/// * Reads the list of known products, patterns, etc.
/// * Holds the user configuration.
/// * Selects and installs the software.
pub struct Service {
    model: Arc<Mutex<dyn ModelAdapter + Send + 'static>>,
    issues: Handler<issue::Service>,
    progress: Handler<progress::Service>,
    events: event::Sender,
    state: Arc<RwLock<ServiceState>>,
    selection: SoftwareSelection,
}

#[derive(Default)]
struct ServiceState {
    config: Config,
    system: SystemInfo,
    proposal: Proposal,
}

impl Service {
    pub fn builder(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
    ) -> Starter {
        Starter::new(events, issues, progress, questions)
    }

    pub async fn setup(&mut self) -> Result<(), Error> {
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
        let state = self.state.read().await;
        Ok(state.system.clone())
    }
}

#[async_trait]
impl MessageHandler<message::GetConfig> for Service {
    async fn handle(&mut self, _message: message::GetConfig) -> Result<Config, Error> {
        let state = self.state.read().await;
        Ok(state.config.clone())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig<Config>> for Service {
    async fn handle(&mut self, message: message::SetConfig<Config>) -> Result<(), Error> {
        let product = message.product.read().await;

        let software = {
            let mut state = self.state.write().await;
            state.config = message.config.clone().unwrap_or_default();
            SoftwareState::build_from(&product, &state.config, &state.system, &self.selection)
        };

        self.events.send(Event::ConfigChanged {
            scope: Scope::Software,
        })?;

        tracing::info!("Wanted software state: {software:?}");

        let model = self.model.clone();
        let issues = self.issues.clone();
        let events = self.events.clone();
        let progress = self.progress.clone();
        let product_spec = product.clone();
        let state = self.state.clone();
        tokio::task::spawn(async move {
            let found_issues = match compute_proposal(model, product_spec, software, progress).await
            {
                Ok((new_proposal, system_info, found_issues)) => {
                    let mut state = state.write().await;
                    state.proposal.software = Some(new_proposal);
                    state.system = system_info;
                    found_issues
                }
                Err(error) => {
                    let new_issue = Issue::new(
                        "software.proposal_failed",
                        "It was not possible to create a software proposal",
                    )
                    .with_details(&error.to_string());
                    let mut state = state.write().await;
                    state.proposal.software = None;
                    vec![new_issue]
                }
            };

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
) -> Result<(SoftwareProposal, SystemInfo, Vec<Issue>), Error> {
    let mut my_model = model.lock().await;
    my_model.set_product(product_spec);
    let issues = my_model.write(wanted, progress).await?;
    let proposal = my_model.proposal().await?;
    let system = my_model.system_info().await?;
    Ok((proposal, system, issues))
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        let state = self.state.read().await;
        Ok(state.proposal.clone().into_option())
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

const LIVE_REPO_DIR: &str = "run/initramfs/live/install";
const DUD_REPO_DIR: &str = "var/lib/agama/dud/repo";

/// Returns the local repositories that will be used during installation.
///
/// By now it considers:
///
/// * Local repository from the off-line media.
/// * Repository with packages from the Driver Update Disk.
fn find_mandatory_repositories<P: Into<PathBuf>>(root: P) -> Vec<Repository> {
    let base = root.into();
    let mut repos = vec![];

    let live_repo_dir = base.join(LIVE_REPO_DIR);
    if let Some(mut install) = find_repository(&live_repo_dir, "Installation") {
        let mount_point = live_repo_dir.display().to_string();
        if let Some(normalized_url) = normalize_repository_url(&mount_point, "/install") {
            install.url = normalized_url;
        }
        repos.push(install);
    }

    let dud_repo_dir = base.join(DUD_REPO_DIR);
    if let Some(dud) = find_repository(&dud_repo_dir, "AgamaDriverUpdate") {
        repos.push(dud)
    }

    repos
}

fn find_repository(dir: &PathBuf, name: &str) -> Option<Repository> {
    if !std::fs::exists(dir).is_ok_and(|e| e) {
        return None;
    }

    Some(Repository {
        alias: name.to_string(),
        name: name.to_string(),
        url: format!("dir:{}", dir.display().to_string()),
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

#[cfg(test)]
mod tests {
    use crate::service::{find_mandatory_repositories, DUD_REPO_DIR, LIVE_REPO_DIR};
    use tempfile::TempDir;

    #[test]
    fn test_find_mandatory_repositories() -> Result<(), Box<dyn std::error::Error>> {
        let tmp_dir = TempDir::with_prefix("test")?;
        std::fs::create_dir_all(&tmp_dir.path().join(LIVE_REPO_DIR))?;
        std::fs::create_dir_all(&tmp_dir.path().join(DUD_REPO_DIR))?;

        let tmp_dir_str = tmp_dir.as_ref().to_str().unwrap();
        let repositories = find_mandatory_repositories(tmp_dir.as_ref());
        let install = repositories.first().unwrap();
        assert_eq!(&install.alias, "Installation");
        assert!(install
            .url
            .contains(&format!("hd:{}/{}", tmp_dir_str, LIVE_REPO_DIR)));
        assert!(install.mandatory);

        let dud = repositories.last().unwrap();
        assert!(dud.url.contains(&format!("/{}", DUD_REPO_DIR)));
        assert_eq!(&dud.alias, "AgamaDriverUpdate");
        assert!(dud.mandatory);
        Ok(())
    }
}
