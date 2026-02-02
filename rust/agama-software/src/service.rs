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
    Model, ResolvableType,
};
use agama_bootloader;
use agama_security as security;
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event::{self, Event},
        software::{Config, Proposal, Repository, SystemInfo},
        Issue, Scope,
    },
    issue,
    kernel_cmdline::KernelCmdline,
    products::ProductSpec,
    progress, question,
};
use async_trait::async_trait;
use std::{path::PathBuf, process::Command, sync::Arc};
use tokio::sync::{broadcast, Mutex, MutexGuard, RwLock};
use url::Url;

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
    security: Handler<security::Service>,
    bootloader: Handler<agama_bootloader::Service>,
}

impl Starter {
    pub fn new(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        security: Handler<security::Service>,
        bootloader: Handler<agama_bootloader::Service>,
    ) -> Self {
        Self {
            model: None,
            events,
            issues,
            progress,
            questions,
            security,
            bootloader,
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

    const TARGET_DIR: &str = "/run/agama/software_ng_zypp";
    // FIXME: it should be defined in a single place and injected where needed.
    const INSTALL_DIR: &str = "/mnt";

    /// Starts the service and returns a handler to communicate with it.
    pub async fn start(self) -> Result<Handler<Service>, Error> {
        let model = match self.model {
            Some(model) => model,
            None => {
                let zypp_sender = ZyppServer::start(Self::TARGET_DIR, Self::INSTALL_DIR)?;
                Arc::new(Mutex::new(Model::new(
                    zypp_sender,
                    find_mandatory_repositories("/"),
                    self.progress.clone(),
                    self.questions.clone(),
                    self.security.clone(),
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
            product: None,
            kernel_cmdline: KernelCmdline::parse().unwrap_or_default(),
            bootloader: self.bootloader,
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
    product: Option<Arc<RwLock<ProductSpec>>>,
    selection: SoftwareSelection,
    kernel_cmdline: KernelCmdline,
    bootloader: Handler<agama_bootloader::Service>,
}

#[derive(Default)]
struct ServiceState {
    config: Config,
    system: SystemInfo,
    proposal: Proposal,
}

impl Service {
    pub fn starter(
        events: event::Sender,
        issues: Handler<issue::Service>,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        security: Handler<security::Service>,
        bootloader: Handler<agama_bootloader::Service>,
    ) -> Starter {
        Starter::new(events, issues, progress, questions, security, bootloader)
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

    fn update_selinux(&self, state: &SoftwareState) {
        let selinux_selected = state.resolvables.to_vec().iter().any(|(name, typ, state)| {
            typ == &ResolvableType::Pattern && name == "selinux" && state.selected()
        });

        let value = if selinux_selected {
            "security=selinux"
        } else {
            "security="
        };
        let message = agama_bootloader::message::SetKernelArg {
            id: "selinux".to_string(),
            value: value.to_string(),
        };
        let res = self.bootloader.cast(message);
        if res.is_err() {
            tracing::warn!("Failed to send to bootloader new selinux state: {:?}", res);
        }
    }

    /// Updates the proposal and the service state.
    ///
    /// This function performs the following actions:
    ///
    /// 1. Calculates the [wanted state](SoftwareState) using the current product, configuration,
    ///    system information and product selection.
    /// 2. Synchronizes the packaging system (through the model adapter).
    /// 3. Emits issues if something is wrong.
    /// 4. Updates the service state (system information and proposal).
    ///
    /// Options from 2 to 4 might take some time, so they run in a separate Tokio task.
    async fn update_proposal(&mut self) -> Result<(), Error> {
        let Some(product) = &self.product else {
            return Ok(());
        };

        let product = product.read().await.clone();

        let new_state = {
            let state = self.state.read().await;
            SoftwareState::build_from(&product, &state.config, &state.system, &self.selection)
        };

        tracing::info!("Wanted software state: {new_state:?}");
        self.update_selinux(&new_state);

        let model = self.model.clone();
        let progress = self.progress.clone();
        let issues = self.issues.clone();
        let state = self.state.clone();
        let events = self.events.clone();

        tokio::task::spawn(async move {
            let mut my_model = model.lock().await;
            my_model.set_product(product);
            let found_issues = my_model
                .write(new_state, progress)
                .await
                .unwrap_or_else(|e| {
                    let new_issue = Issue::new(
                        "software.proposal_failed",
                        "It was not possible to create a software proposal",
                    )
                    .with_details(&e.to_string());
                    vec![new_issue]
                });
            _ = issues.cast(issue::message::Set::new(Scope::Software, found_issues));

            Self::update_state(state, my_model, events).await;
        });
        Ok(())
    }

    /// Ancillary function to updates the service state with the information from the model.
    ///
    /// FIXME: emit events only when the proposal or the system information change.
    async fn update_state(
        state: Arc<RwLock<ServiceState>>,
        model: MutexGuard<'_, dyn ModelAdapter + Send + 'static>,
        events: event::Sender,
    ) {
        let mut state = state.write().await;

        match model.proposal().await {
            Ok(proposal) => {
                state.proposal.software = Some(proposal);
                _ = events.send(Event::ProposalChanged {
                    scope: Scope::Software,
                });
            }
            Err(error) => {
                tracing::error!("Could not update the software proposal: {error}.")
            }
        }

        match model.system_info().await {
            Ok(system_info) => {
                state.system = system_info;
                _ = events.send(Event::SystemChanged {
                    scope: Scope::Software,
                });
            }
            Err(error) => {
                tracing::error!("Could not update the software information: {error}.");
            }
        }
    }

    /// Completes the configuration with data from the kernel command-line.
    ///
    /// - Use `inst.register_url` as default value for `product.registration_url`.
    fn add_kernel_cmdline_defaults(&mut self, config: &mut Config) {
        let Some(product) = &mut config.product else {
            return;
        };

        if product.registration_url.is_some() {
            return;
        }

        product.registration_url = self
            .kernel_cmdline
            .get_last("inst.register_url")
            .map(|url| Url::parse(&url).ok())
            .flatten();
    }

    /// Completes the configuration with the product mode if it is missing.
    ///
    /// Agama uses the first available mode (if any) in case the user does not set one.
    async fn add_product_mode(&mut self, config: &mut Config) {
        let Some(product_config) = &mut config.product else {
            return;
        };

        if product_config.mode.is_some() {
            return;
        }

        let Some(selected_product) = &self.product else {
            return;
        };

        let selected_product = selected_product.read().await;
        product_config.mode = selected_product.mode.clone();
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
        self.product = Some(message.product.clone());

        let mut config = message.config.clone().unwrap_or_default();
        self.add_kernel_cmdline_defaults(&mut config);
        self.add_product_mode(&mut config).await;

        {
            let mut state = self.state.write().await;
            state.config = config;
        }

        self.events.send(Event::ConfigChanged {
            scope: Scope::Software,
        })?;

        self.update_proposal().await?;

        Ok(())
    }
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
        if self.product.is_some() {
            self.update_proposal().await?;
        }
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

/// Returns the repository for the given directory if it exists.
fn find_repository(dir: &PathBuf, name: &str) -> Option<Repository> {
    if !std::fs::exists(dir).is_ok_and(|e| e) {
        return None;
    }

    let url_string = format!("dir:{}", dir.display().to_string());
    let Ok(url) = Url::parse(&url_string) else {
        tracing::warn!(
            "'{}' is not a valid URL. Ignoring the repository.",
            url_string
        );
        return None;
    };

    Some(Repository {
        alias: name.to_string(),
        name: name.to_string(),
        url: url.to_string(),
        enabled: true,
        predefined: true,
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
        assert!(install.predefined);

        let dud = repositories.last().unwrap();
        assert!(dud.url.contains(&format!("/{}", DUD_REPO_DIR)));
        assert_eq!(&dud.alias, "AgamaDriverUpdate");
        assert!(dud.predefined);
        Ok(())
    }
}
