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

use std::{ops::DerefMut, process::Command, sync::Arc};

use crate::{
    message,
    model::{
        license::{Error as LicenseError, LicensesRepo},
        packages::{self, Repository, ResolvableType},
        products::{ProductSpec, ProductsRegistry, ProductsRegistryError},
        software_selection::SoftwareSelection,
        state::{self, SoftwareState},
        ModelAdapter,
    },
    proposal::Proposal,
    system_info::SystemInfo,
    zypp_server::{self, SoftwareAction},
};
use agama_utils::{
    actor::{self, Actor, Handler, MessageHandler},
    api::{
        event::{self, Event},
        software::{Config, ProductConfig, RepositoryParams},
        Scope,
    },
    issue,
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
    ProductsRegistry(#[from] ProductsRegistryError),
    #[error(transparent)]
    License(#[from] LicenseError),
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
    products: ProductsRegistry,
    licenses: LicensesRepo,
    issues: Handler<issue::Service>,
    events: event::Sender,
    state: State,
}

#[derive(Default)]
struct State {
    config: Config,
    system: Arc<RwLock<SystemInfo>>,
}

impl Service {
    pub fn new<T: ModelAdapter>(
        model: T,
        issues: Handler<issue::Service>,
        events: event::Sender,
    ) -> Service {
        Self {
            model: Arc::new(Mutex::new(model)),
            issues,
            events,
            licenses: LicensesRepo::default(),
            products: ProductsRegistry::default(),
            state: Default::default(),
        }
    }

    pub async fn read(&mut self) -> Result<(), Error> {
        self.licenses.read()?;
        self.products.read()?;
        let mut system = self.state.system.write().await;
        system.licenses = self.licenses.licenses().into_iter().cloned().collect();
        system.products = self.products.products();
        if let Some(install_repo) = find_install_repository() {
            tracing::info!("Found repository at {}", install_repo.url);
            system.repositories.push(install_repo);
        }
        Ok(())
    }

    async fn update_system(&self) -> Result<(), Error> {
        let licenses = self.licenses.licenses().into_iter().cloned().collect();
        let products = self.products.products();

        let mut system = self.state.system.write().await;
        system.licenses = licenses;
        system.products = products;

        self.events.send(Event::SystemChanged {
            scope: Scope::Software,
        })?;

        Ok(())
    }

    async fn apply_config(config: &Config, model: &mut dyn ModelAdapter) -> Result<(), Error> {
        if let Some(software) = &config.software {
            let user_id = "user";
            let patterns = software.patterns.clone().unwrap_or_default();
            let packages = software.packages.clone().unwrap_or_default();
            let extra_repositories = software.extra_repositories.clone().unwrap_or_default();
            // TODO: patterns as it as it can be either set or add/remove set
            model
                .set_resolvables(user_id, ResolvableType::Package, packages, false)
                .await?;
            // for repositories we should allow also to remove previously defined one, but now for simplicity just check if it there and if not, then add it
            // TODO: replace it with future repository registry
            let existing_repositories = model.repositories().await?;
            let new_repos = extra_repositories
                .iter()
                .filter(|r| {
                    existing_repositories
                        .iter()
                        .find(|repo| repo.alias == r.alias)
                        .is_none()
                })
                .cloned()
                .collect();
            model.add_repositories(new_repos).await?;
        }

        Ok(())
    }
}

impl Actor for Service {
    type Error = Error;
}

#[async_trait]
impl MessageHandler<message::GetSystem> for Service {
    async fn handle(&mut self, _message: message::GetSystem) -> Result<SystemInfo, Error> {
        Ok(self.state.system.read().await.clone())
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
        let product = message.config.product.as_ref();

        // handle product
        let Some(new_product_id) = &product.and_then(|p| p.id.as_ref()) else {
            return Ok(());
        };

        let Some(new_product) = self.products.find(new_product_id.as_str()) else {
            // FIXME: return an error.
            return Ok(());
        };

        self.state.config = message.config.clone();
        self.events.send(Event::ConfigChanged {
            scope: Scope::Software,
        })?;

        let system = self.state.system.read().await.clone();

        // NOTE: we should read the system to get the local repositories.
        let software = SoftwareState::build_from(new_product, &message.config, &system);

        let model = self.model.clone();
        let issues = self.issues.clone();
        tokio::task::spawn(async move {
            let mut my_model = model.lock().await;
            let found_issues = my_model.write(software).await.unwrap();
            if !found_issues.is_empty() {
                _ = issues.cast(issue::message::Update::new(Scope::Software, found_issues));
            }
        });

        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::GetProposal> for Service {
    async fn handle(&mut self, _message: message::GetProposal) -> Result<Option<Proposal>, Error> {
        todo!();
    }
}

#[async_trait]
impl MessageHandler<message::Probe> for Service {
    async fn handle(&mut self, _message: message::Probe) -> Result<(), Error> {
        let Some(product_id) = self.state.config.product.clone().and_then(|c| c.id) else {
            return Err(Error::MissingProduct);
        };

        let Some(product) = self.products.find(&product_id) else {
            return Err(Error::WrongProduct(product_id));
        };

        self.model.lock().await.probe(product).await?;
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

const LIVE_REPO_DIR: &str = "/run/initramfs/live/install";

fn find_install_repository() -> Option<packages::Repository> {
    if !std::fs::exists(LIVE_REPO_DIR).is_ok_and(|e| e) {
        return None;
    }

    normalize_repository_url(LIVE_REPO_DIR, "/install").map(|url| packages::Repository {
        id: None,
        alias: "install".to_string(),
        name: "install".to_string(),
        url,
        product_dir: "".to_string(),
        loaded: false,
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
