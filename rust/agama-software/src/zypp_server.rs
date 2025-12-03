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

use agama_utils::{
    actor::Handler,
    api::{
        self,
        software::{Pattern, SelectedBy, SoftwareProposal, SystemInfo},
        Issue, Scope,
    },
    products::ProductSpec,
    progress, question,
};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
};

use tokio::sync::{
    mpsc::{self, UnboundedSender},
    oneshot,
};
use zypp_agama::{errors::ZyppResult, ZyppError};

use crate::{
    callbacks,
    model::state::{self, SoftwareState},
};

const GPG_KEYS: &str = "/usr/lib/rpm/gnupg/keys/gpg-*";

#[derive(thiserror::Error, Debug)]
pub enum ZyppDispatchError {
    #[error(transparent)]
    Zypp(#[from] ZyppError),
    #[error("libzypp error: {0}")]
    ZyppServer(#[from] ZyppServerError),
    #[error("Response channel closed")]
    ResponseChannelClosed,
    #[error("Target creation failed: {0}")]
    TargetCreationFailed(#[source] std::io::Error),
    #[error(transparent)]
    Progress(#[from] progress::service::Error),
}

#[derive(thiserror::Error, Debug)]
pub enum ZyppServerError {
    #[error("Response channel closed")]
    ResponseChannelClosed,

    #[error("Receiver error: {0}")]
    RecvError(#[from] oneshot::error::RecvError),

    #[error("Sender error: {0}")]
    SendError(#[from] mpsc::error::SendError<SoftwareAction>),

    #[error("Error from libzypp: {0}")]
    ZyppError(#[from] zypp_agama::ZyppError),

    #[error("Could not find a mount point to calculate the used space")]
    MissingMountPoint,
}

pub type ZyppServerResult<R> = Result<R, ZyppServerError>;

pub enum SoftwareAction {
    Install(
        oneshot::Sender<ZyppServerResult<bool>>,
        Handler<progress::Service>,
        Handler<question::Service>,
    ),
    Finish(oneshot::Sender<ZyppServerResult<()>>),
    GetSystemInfo(ProductSpec, oneshot::Sender<ZyppServerResult<SystemInfo>>),
    GetProposal(
        ProductSpec,
        oneshot::Sender<ZyppServerResult<SoftwareProposal>>,
    ),
    Write {
        state: SoftwareState,
        progress: Handler<progress::Service>,
        question: Handler<question::Service>,
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
    },
}

/// Software service server.
pub struct ZyppServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    root_dir: PathBuf,
}

impl ZyppServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate thread and gets the client requests using a channel.
    pub fn start<P: AsRef<Path>>(root_dir: P) -> ZyppServerResult<UnboundedSender<SoftwareAction>> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let server = Self {
            receiver,
            root_dir: root_dir.as_ref().to_path_buf(),
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
        Ok(sender)
    }

    /// Runs the server dispatching the actions received through the input channel.
    async fn run(mut self) -> Result<(), ZyppDispatchError> {
        let zypp = self.initialize_target_dir()?;

        loop {
            let action = self.receiver.recv().await;
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
    ) -> Result<(), ZyppDispatchError> {
        match action {
            SoftwareAction::Write {
                state,
                progress,
                question,
                tx,
            } => {
                let mut security_callback = callbacks::Security::new(question);
                self.write(state, progress, &mut security_callback, tx, zypp)
                    .await?;
            }
            SoftwareAction::GetSystemInfo(product_spec, tx) => {
                self.system_info(product_spec, tx, zypp).await?;
            }
            SoftwareAction::Install(tx, progress, question) => {
                let mut download_callback =
                    callbacks::CommitDownload::new(progress.clone(), question.clone());
                let mut install_callback =
                    callbacks::Install::new(progress.clone(), question.clone());
                let mut security_callback = callbacks::Security::new(question);
                tx.send(self.install(
                    zypp,
                    &mut download_callback,
                    &mut install_callback,
                    &mut security_callback,
                ))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            }
            SoftwareAction::Finish(tx) => {
                self.finish(zypp, tx).await?;
            }
            SoftwareAction::GetProposal(product_spec, sender) => {
                self.proposal(product_spec, sender, zypp).await?
            }
        }
        Ok(())
    }

    // Install rpms
    fn install(
        &self,
        zypp: &zypp_agama::Zypp,
        download_callback: &mut callbacks::CommitDownload,
        install_callback: &mut callbacks::Install,
        security_callback: &mut callbacks::Security,
    ) -> ZyppServerResult<bool> {
        let target = "/mnt";
        zypp.switch_target(target)?;
        let result = zypp.commit(download_callback, install_callback, security_callback)?;
        tracing::info!("libzypp commit ends with {}", result);
        Ok(result)
    }

    fn read(&self, zypp: &zypp_agama::Zypp) -> Result<SoftwareState, ZyppError> {
        let repositories = zypp
            .list_repositories()?
            .into_iter()
            .map(|repo| state::Repository {
                name: repo.user_name,
                alias: repo.alias,
                url: repo.url,
                enabled: repo.enabled,
            })
            .collect();

        let state = SoftwareState {
            // FIXME: read the real product. It is not a problem because it is replaced
            // later.
            product: "SLES".to_string(),
            repositories,
            resolvables: vec![],
            options: Default::default(),
        };
        Ok(state)
    }

    async fn write(
        &self,
        state: SoftwareState,
        progress: Handler<progress::Service>,
        security: &mut callbacks::Security,
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let mut issues: Vec<Issue> = vec![];

        _ = progress.cast(progress::message::StartWithSteps::new(
            Scope::Software,
            &[
                "Updating the list of repositories",
                "Refreshing metadata from the repositories",
                "Calculating the software proposal",
            ],
        ));
        let old_state = self.read(zypp)?;
        let old_aliases: Vec<_> = old_state
            .repositories
            .iter()
            .map(|r| r.alias.clone())
            .collect();
        let aliases: Vec<_> = state.repositories.iter().map(|r| r.alias.clone()).collect();

        let to_add: Vec<_> = state
            .repositories
            .iter()
            .filter(|r| !old_aliases.contains(&r.alias))
            .collect();

        let to_remove: Vec<_> = old_state
            .repositories
            .iter()
            .filter(|r| !aliases.contains(&r.alias))
            .collect();

        for repo in &to_add {
            let result = zypp.add_repository(&repo.alias, &repo.url, |percent, alias| {
                tracing::info!("Adding repository {} ({}%)", alias, percent);
                true
            });

            if let Err(error) = result {
                let message = format!("Could not add the repository {}", repo.alias);
                issues.push(
                    Issue::new("software.add_repo", &message).with_details(&error.to_string()),
                );
            }
            // Add an issue if it was not possible to add the repository.
        }

        for repo in &to_remove {
            let result = zypp.remove_repository(&repo.alias, |percent, alias| {
                tracing::info!("Removing repository {} ({}%)", alias, percent);
                true
            });

            if let Err(error) = result {
                let message = format!("Could not remove the repository {}", repo.alias);
                issues.push(
                    Issue::new("software.remove_repo", &message).with_details(&error.to_string()),
                );
            }
        }

        progress.cast(progress::message::Next::new(Scope::Software))?;
        if to_add.is_empty() || to_remove.is_empty() {
            let result = zypp.load_source(
                |percent, alias| {
                    tracing::info!("Refreshing repositories: {} ({}%)", alias, percent);
                    true
                },
                security,
            );

            if let Err(error) = result {
                let message = format!("Could not read the repositories");
                issues.push(
                    Issue::new("software.load_source", &message).with_details(&error.to_string()),
                );
            }
        }

        // reset everything to start from scratch
        zypp.reset_resolvables();

        _ = progress.cast(progress::message::Next::new(Scope::Software));
        let result = zypp.select_resolvable(
            &state.product,
            zypp_agama::ResolvableKind::Product,
            zypp_agama::ResolvableSelected::Installation,
        );
        if let Err(error) = result {
            let message = format!("Could not select the product '{}'", &state.product);
            issues.push(
                Issue::new("software.select_product", &message).with_details(&error.to_string()),
            );
        }
        for resolvable_state in &state.resolvables {
            let resolvable = &resolvable_state.resolvable;
            let result = zypp.select_resolvable(
                &resolvable.name,
                resolvable.r#type.into(),
                resolvable_state.reason.into(),
            );

            if let Err(error) = result {
                if resolvable_state.reason.is_optional() {
                    tracing::info!(
                        "Could not select '{}' but it is optional.",
                        &resolvable.name
                    );
                } else {
                    let message = format!("Could not select '{}'", &resolvable.name);
                    issues.push(
                        Issue::new("software.select_resolvable", &message)
                            .with_details(&error.to_string()),
                    );
                }
            }
        }

        _ = progress.cast(progress::message::Finish::new(Scope::Software));
        match zypp.run_solver() {
            Ok(result) => println!("Solver result: {result}"),
            Err(error) => println!("Solver failed: {error}"),
        };

        tx.send(Ok(issues)).unwrap();
        Ok(())
    }

    async fn finish(
        &mut self,
        zypp: &zypp_agama::Zypp,
        tx: oneshot::Sender<ZyppServerResult<()>>,
    ) -> Result<(), ZyppDispatchError> {
        if let Err(error) = self.remove_dud_repo(zypp) {
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        if let Err(error) = self.disable_local_repos(zypp) {
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        let _ = self.registration_finish(); // TODO: move it outside of zypp server as it do not need zypp lock
        let _ = self.modify_zypp_conf(); // TODO: move it outside of zypp server as it do not need zypp lock

        if let Err(error) = self.modify_full_repo(zypp) {
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        Ok(())
    }

    fn modify_full_repo(&self, zypp: &zypp_agama::Zypp) -> ZyppServerResult<()> {
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

    fn remove_dud_repo(&self, zypp: &zypp_agama::Zypp) -> ZyppServerResult<()> {
        const DUD_NAME: &str = "AgamaDriverUpdate";
        let repos = zypp.list_repositories()?;
        let repo = repos.iter().find(|r| r.alias.as_str() == DUD_NAME);
        if let Some(repo) = repo {
            zypp.remove_repository(&repo.alias, |_, _| true)?;
        }
        Ok(())
    }

    fn disable_local_repos(&self, zypp: &zypp_agama::Zypp) -> ZyppServerResult<()> {
        let repos = zypp.list_repositories()?;
        // if url is invalid, then do not disable it and do not touch it
        let repos = repos.iter().filter(|r| r.is_local().unwrap_or(false));
        for r in repos {
            zypp.disable_repository(&r.alias)?;
        }
        Ok(())
    }

    fn registration_finish(&self) -> ZyppServerResult<()> {
        // TODO: implement when registration is ready
        Ok(())
    }

    fn modify_zypp_conf(&self) -> ZyppServerResult<()> {
        // TODO: implement when requireOnly is implemented
        Ok(())
    }

    async fn system_info(
        &self,
        product: ProductSpec,
        tx: oneshot::Sender<ZyppServerResult<SystemInfo>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let patterns = self.patterns(&product, zypp).await?;
        let repositories = self.repositories(zypp).await?;

        let system_info = SystemInfo {
            patterns,
            repositories,
            addons: vec![],
        };

        tx.send(Ok(system_info))
            .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn patterns(
        &self,
        product: &ProductSpec,
        zypp: &zypp_agama::Zypp,
    ) -> ZyppResult<Vec<Pattern>> {
        let pattern_names: Vec<_> = product
            .software
            .user_patterns
            .iter()
            .map(|p| p.name())
            .collect();

        let patterns = zypp.patterns_info(pattern_names)?;

        let patterns = patterns
            .into_iter()
            .map(|p| Pattern {
                name: p.name,
                category: p.category,
                description: p.description,
                icon: p.icon,
                summary: p.summary,
                order: p.order,
            })
            .collect();
        Ok(patterns)
    }

    async fn repositories(
        &self,
        zypp: &zypp_agama::Zypp,
    ) -> ZyppResult<Vec<api::software::Repository>> {
        let result = zypp
            .list_repositories()?
            .into_iter()
            .map(|r| api::software::Repository {
                alias: r.alias.clone(),
                name: r.alias,
                url: r.url,
                enabled: r.enabled,
                // At this point, there is no way to determine if the repository is
                // predefined or not. It will be adjusted in the Model::repositories
                // function.
                predefined: false,
            })
            .collect();
        Ok(result)
    }

    fn initialize_target_dir(&self) -> Result<zypp_agama::Zypp, ZyppDispatchError> {
        let target_dir = self.root_dir.as_path();
        std::fs::create_dir_all(target_dir).map_err(ZyppDispatchError::TargetCreationFailed)?;

        // FIXME: use camino::Utf8PathBuf or String
        let zypp =
            zypp_agama::Zypp::init_target(target_dir.to_str().unwrap(), |text, step, total| {
                tracing::info!("Initializing target: {} ({}/{})", text, step, total);
            })?;

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

    async fn proposal(
        &self,
        product: ProductSpec,
        tx: oneshot::Sender<ZyppServerResult<SoftwareProposal>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let proposal = SoftwareProposal {
            used_space: self.used_space(&zypp).await?,
            patterns: self.patterns_selection(&product, &zypp).await?,
        };

        tx.send(Ok(proposal))
            .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
        Ok(())
    }

    async fn used_space(&self, zypp: &zypp_agama::Zypp) -> Result<i64, ZyppServerError> {
        // TODO: for now it just compute total size, but it can get info about partitions from storage and pass it to libzypp
        let mount_points = vec![zypp_agama::MountPoint {
            directory: "/".to_string(),
            filesystem: "btrfs".to_string(),
            grow_only: false, // not sure if it has effect as we install everything fresh
            used_size: 0,
        }];
        let computed_mount_points = zypp.count_disk_usage(mount_points)?;
        computed_mount_points
            .first()
            .map(|m| m.used_size)
            .ok_or(ZyppServerError::MissingMountPoint)
    }

    async fn patterns_selection(
        &self,
        product: &ProductSpec,
        zypp: &zypp_agama::Zypp,
    ) -> Result<HashMap<String, SelectedBy>, ZyppServerError> {
        let pattern_names = product
            .software
            .user_patterns
            .iter()
            .map(|p| p.name())
            .collect();
        let patterns_info = zypp.patterns_info(pattern_names);
        patterns_info
            .map(|patterns| {
                patterns
                    .iter()
                    .map(|pattern| {
                        let tag = match pattern.selected {
                            zypp_agama::ResolvableSelected::Installation => SelectedBy::Auto,
                            zypp_agama::ResolvableSelected::Not => SelectedBy::None,
                            zypp_agama::ResolvableSelected::Solver => SelectedBy::Auto,
                            zypp_agama::ResolvableSelected::User => SelectedBy::User,
                        };
                        (pattern.name.clone(), tag)
                    })
                    .collect()
            })
            .map_err(|e| e.into())
    }
}
