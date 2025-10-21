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

use std::{path::Path, sync::Arc};

use agama_lib::{
    http::event,
    product::Product,
    software::{
        model::{ResolvableType, SoftwareConfig, SoftwareSelection},
        Pattern,
    },
};
use tokio::sync::{mpsc, oneshot, Mutex};

use crate::{
    products::{ProductSpec, ProductsRegistry},
    software_ng::backend::SoftwareServiceResult,
};

use super::{client::SoftwareServiceClient, SoftwareServiceError};

const TARGET_DIR: &str = "/run/agama/software_ng_zypp";
const GPG_KEYS: &str = "/usr/lib/rpm/gnupg/keys/gpg-*";

#[derive(Debug)]
pub enum SoftwareAction {
    Probe,
    Install(oneshot::Sender<bool>),
    Finish,
    GetProducts(oneshot::Sender<Vec<Product>>),
    GetPatterns(oneshot::Sender<Vec<Pattern>>),
    GetConfig(oneshot::Sender<SoftwareConfig>),
    PackageAvailable(String, oneshot::Sender<bool>),
    PackageSelected(String, oneshot::Sender<bool>),
    SelectProduct(String),
    SetResolvables {
        id: String,
        r#type: ResolvableType,
        resolvables: Vec<String>,
        optional: bool,
    },
    GetResolvables {
        tx: oneshot::Sender<Vec<String>>,
        id: String,
        r#type: ResolvableType,
        optional: bool,
    },
}

/// Software service server.
pub struct SoftwareServiceServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    events: event::Sender,
    products: Arc<Mutex<ProductsRegistry>>,
    // FIXME: what about having a SoftwareServiceState to keep business logic state?
    selected_product: Option<String>,
    software_selection: SoftwareSelection,
}

impl SoftwareServiceServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate thread and gets the client requests using a channel.
    pub fn start(
        events: event::Sender,
        products: Arc<Mutex<ProductsRegistry>>,
    ) -> SoftwareServiceResult<SoftwareServiceClient> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let server = Self {
            receiver,
            events,
            products,
            selected_product: None,
            software_selection: SoftwareSelection::default(),
        };

        // see https://docs.rs/tokio/latest/tokio/task/struct.LocalSet.html#use-inside-tokiospawn for explain how to ensure that zypp
        // runs locally on single thread

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        // drop the returned JoinHandle: the thread will be detached
        // but that's OK for it to run until the process dies
        std::thread::spawn(move || {
            let local = tokio::task::LocalSet::new();

            local.spawn_local(server.run());

            // This will return once all senders are dropped and all
            // spawned tasks have returned.
            rt.block_on(local);
        });
        Ok(SoftwareServiceClient::new(sender))
    }

    /// Runs the server dispatching the actions received through the input channel.
    async fn run(mut self) -> SoftwareServiceResult<()> {
        let zypp = self.initialize_target_dir()?;

        loop {
            let action = self.receiver.recv().await;
            tracing::debug!("software dispatching action: {:?}", action);
            let Some(action) = action else {
                tracing::error!("Software action channel closed");
                break;
            };

            if let Err(error) = self.dispatch(action, &zypp).await {
                tracing::error!("Software dispatch error: {:?}", error);
            }
        }

        Ok(())
    }

    /// Forwards the action to the appropriate handler.
    async fn dispatch(
        &mut self,
        action: SoftwareAction,
        zypp: &zypp_agama::Zypp,
    ) -> SoftwareServiceResult<()> {
        match action {
            SoftwareAction::GetProducts(tx) => {
                self.get_products(tx).await?;
            }

            SoftwareAction::GetPatterns(tx) => {
                self.get_patterns(tx, zypp).await?;
            }

            SoftwareAction::SelectProduct(product_id) => {
                self.select_product(product_id).await?;
            }

            SoftwareAction::GetConfig(tx) => {
                self.get_config(tx).await?;
            }

            SoftwareAction::PackageSelected(tag, tx) => {
                self.package_selected(zypp, tag, tx).await?;
            }

            SoftwareAction::PackageAvailable(tag, tx) => {
                self.package_available(zypp, tag, tx).await?;
            }

            SoftwareAction::Probe => {
                self.probe(zypp).await?;
                self.run_solver(zypp)?;
            }

            SoftwareAction::Install(tx) => {
                tx.send(self.install(zypp)?)
                    .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
            }

            SoftwareAction::Finish => {
                self.finish(zypp).await?;
            }

            SoftwareAction::SetResolvables {
                id,
                r#type,
                resolvables,
                optional,
            } => {
                self.set_resolvables(zypp, id, r#type, resolvables, optional)?;
                self.run_solver(zypp)?;
            }

            SoftwareAction::GetResolvables {
                tx,
                id,
                r#type,
                optional,
            } => {
                let result = self
                    .software_selection
                    .get(&id, r#type, optional)
                    .unwrap_or(vec![]); // Option::unwrap is OK
                tx.send(result)
                    .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
            }
        }
        Ok(())
    }

    fn set_resolvables(
        &mut self,
        zypp: &zypp_agama::Zypp,
        id: String,
        r#type: ResolvableType,
        resolvables: Vec<String>,
        optional: bool,
    ) -> SoftwareServiceResult<()> {
        tracing::info!(
            "Set resolvables for {} with type {} optional {} and list {:?}",
            id,
            r#type,
            optional,
            resolvables
        );
        let resolvables: Vec<_> = resolvables.iter().map(String::as_str).collect();
        self.software_selection
            .set(zypp, &id, r#type, optional, &resolvables)?;
        Ok(())
    }

    // runs solver. It should be able in future to generate solver issues
    fn run_solver(&self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        let result = zypp.run_solver()?;
        tracing::info!("Solver runs ends with {}", result);
        Ok(())
    }

    // Install rpms
    fn install(&self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<bool> {
        let target = "/mnt";
        zypp.switch_target(target)?;
        let result = zypp.commit()?;
        tracing::info!("libzypp commit ends with {}", result);
        Ok(result)
    }

    /// Select the given product.
    async fn select_product(&mut self, product_id: String) -> SoftwareServiceResult<()> {
        tracing::info!("Selecting product {}", product_id);
        let products = self.products.lock().await;
        if products.find(&product_id).is_none() {
            return Err(SoftwareServiceError::UnknownProduct(product_id));
        };

        self.selected_product = Some(product_id.clone());
        Ok(())
    }

    async fn probe(&mut self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        let product = self.find_selected_product().await?;
        let repositories = product.software.repositories();
        for (idx, repo) in repositories.iter().enumerate() {
            // TODO: we should add a repository ID in the configuration file.
            let name = format!("agama-{}", idx);
            zypp.add_repository(&name, &repo.url, |percent, alias| {
                tracing::info!("Adding repository {} ({}%)", alias, percent);
                true
            })
            .map_err(SoftwareServiceError::AddRepositoryFailed)?;
        }

        zypp.load_source(|percent, alias| {
            tracing::info!("Refreshing repositories: {} ({}%)", alias, percent);
            true
        })
        .map_err(SoftwareServiceError::LoadSourcesFailed)?;

        self.select_product_software(zypp, product)?;

        Ok(())
    }

    async fn finish(&mut self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        self.remove_dud_repo(zypp)?;
        self.disable_local_repos(zypp)?;
        self.registration_finish()?;
        self.modify_zypp_conf()?;
        self.modify_full_repo(zypp)?;
        Ok(())
    }

    fn modify_full_repo(&self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        let repos = zypp.list_repositories()?;
        // if url is invalid, then do not disable it and do not touch it
        let repos = repos
            .iter()
            .filter(|r| r.url.starts_with("dvd:/install?devices="));
        for r in repos {
            zypp.set_repository_url(&r.alias, "dvd:/install")?;
        }
        Ok(())
    }

    fn remove_dud_repo(&self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        const DUD_NAME: &str = "AgamaDriverUpdate";
        let repos = zypp.list_repositories()?;
        let repo = repos.iter().find(|r| r.alias.as_str() == DUD_NAME);
        if let Some(repo) = repo {
            zypp.remove_repository(&repo.alias, |_, _| true)?;
        }
        Ok(())
    }

    fn disable_local_repos(&self, zypp: &zypp_agama::Zypp) -> SoftwareServiceResult<()> {
        let repos = zypp.list_repositories()?;
        // if url is invalid, then do not disable it and do not touch it
        let repos = repos.iter().filter(|r| r.is_local().unwrap_or(false));
        for r in repos {
            zypp.disable_repository(&r.alias)?;
        }
        Ok(())
    }

    fn registration_finish(&self) -> SoftwareServiceResult<()> {
        // TODO: implement when registration is ready
        Ok(())
    }

    fn modify_zypp_conf(&self) -> SoftwareServiceResult<()> {
        // TODO: implement when requireOnly is implemented
        Ok(())
    }

    fn select_product_software(
        &mut self,
        zypp: &zypp_agama::Zypp,
        product: ProductSpec,
    ) -> SoftwareServiceResult<()> {
        let installer_id_string = "installer".to_string();
        self.set_resolvables(
            zypp,
            installer_id_string.clone(),
            ResolvableType::Product,
            vec![product.software.base_product.clone()],
            false,
        )?;
        self.set_resolvables(
            zypp,
            installer_id_string.clone(),
            ResolvableType::Package,
            product.software.mandatory_packages,
            false,
        )?;
        self.set_resolvables(
            zypp,
            installer_id_string.clone(),
            ResolvableType::Pattern,
            product.software.mandatory_patterns,
            false,
        )?;
        self.set_resolvables(
            zypp,
            installer_id_string.clone(),
            ResolvableType::Package,
            product.software.optional_packages,
            true,
        )?;
        self.set_resolvables(
            zypp,
            installer_id_string.clone(),
            ResolvableType::Pattern,
            product.software.optional_patterns,
            true,
        )?;
        Ok(())
    }

    /// Returns the software config.
    async fn get_config(&self, tx: oneshot::Sender<SoftwareConfig>) -> SoftwareServiceResult<()> {
        let result = SoftwareConfig {
            // TODO: implement all Nones
            packages: None,
            patterns: None,
            product: self.selected_product.clone(),
            extra_repositories: None,
            only_required: None,
        };
        tx.send(result)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn package_available(
        &self,
        zypp: &zypp_agama::Zypp,
        tag: String,
        tx: oneshot::Sender<bool>,
    ) -> SoftwareServiceResult<()> {
        let result = zypp.is_package_available(&tag)?;
        tx.send(result)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn package_selected(
        &self,
        zypp: &zypp_agama::Zypp,
        tag: String,
        tx: oneshot::Sender<bool>,
    ) -> SoftwareServiceResult<()> {
        let result = zypp.is_package_selected(&tag)?;
        tx.send(result)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    /// Returns the list of products.
    async fn get_products(&self, tx: oneshot::Sender<Vec<Product>>) -> SoftwareServiceResult<()> {
        let products = self.products.lock().await;
        // FIXME: implement this conversion at model's level.
        let products: Vec<_> = products
            .products
            .iter()
            .map(|p| Product {
                id: p.id.clone(),
                name: p.name.clone(),
                description: p.description.clone(),
                icon: p.icon.clone(),
                registration: p.registration,
                license: None,
            })
            .collect();
        tx.send(products)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn get_patterns(
        &self,
        tx: oneshot::Sender<Vec<Pattern>>,
        zypp: &zypp_agama::Zypp,
    ) -> SoftwareServiceResult<()> {
        let product = self.find_selected_product().await?;

        let mandatory_patterns = product.software.mandatory_patterns.iter();
        let optional_patterns = product.software.optional_patterns.iter();
        let pattern_names: Vec<&str> = vec![mandatory_patterns, optional_patterns]
            .into_iter()
            .flatten()
            .map(String::as_str)
            .collect();

        let patterns = zypp
            .patterns_info(pattern_names)
            .map_err(SoftwareServiceError::ListPatternsFailed)?;

        let patterns = patterns
            .into_iter()
            .map(|info| Pattern {
                name: info.name,
                category: info.category,
                description: info.description,
                icon: info.icon,
                summary: info.summary,
                order: info.order,
            })
            .collect();

        tx.send(patterns)
            .map_err(|_| SoftwareServiceError::ResponseChannelClosed)?;
        Ok(())
    }

    fn initialize_target_dir(&self) -> SoftwareServiceResult<zypp_agama::Zypp> {
        let target_dir = Path::new(TARGET_DIR);
        if target_dir.exists() {
            _ = std::fs::remove_dir_all(target_dir);
        }

        std::fs::create_dir_all(target_dir).map_err(SoftwareServiceError::TargetCreationFailed)?;

        let zypp = zypp_agama::Zypp::init_target(TARGET_DIR, |text, step, total| {
            tracing::info!("Initializing target: {} ({}/{})", text, step, total);
        })
        .map_err(SoftwareServiceError::TargetInitFailed)?;

        self.import_gpg_keys(&zypp);
        Ok(zypp)
    }

    fn import_gpg_keys(&self, zypp: &zypp_agama::Zypp) {
        for file in glob::glob(GPG_KEYS).unwrap() {
            match file {
                Ok(file) => {
                    if let Err(e) = zypp.import_gpg_key(&file.to_string_lossy()) {
                        tracing::error!("Failed to import GPG key: {}", e);
                    }
                }
                Err(e) => {
                    tracing::error!("Could not read GPG key file: {}", e);
                }
            }
        }
    }

    // Returns the spec of the selected product.
    //
    // It causes the spec to be cloned, so we should find a better way to do this.
    async fn find_selected_product(&self) -> SoftwareServiceResult<ProductSpec> {
        let products = self.products.lock().await;
        let Some(product_id) = &self.selected_product else {
            return Err(SoftwareServiceError::NoSelectedProduct);
        };

        let Some(product) = products.find(product_id) else {
            return Err(SoftwareServiceError::UnknownProduct(product_id.clone()));
        };

        Ok(product.clone())
    }
}
