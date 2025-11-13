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
        software::{Pattern, SelectedBy, SoftwareProposal},
        Issue, IssueSeverity, Scope,
    },
    products_registry::ProductSpec,
    progress,
};
use std::path::Path;
use tokio::sync::{
    mpsc::{self, UnboundedSender},
    oneshot,
};
use zypp_agama::ZyppError;

use crate::model::state::{self, SoftwareState};
const TARGET_DIR: &str = "/run/agama/software_ng_zypp";
const GPG_KEYS: &str = "/usr/lib/rpm/gnupg/keys/gpg-*";

#[derive(thiserror::Error, Debug)]
pub enum ZyppDispatchError {
    #[error("Failed to initialize libzypp: {0}")]
    InitError(#[from] ZyppError),
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

    #[error("Unknown product: {0}")]
    UnknownProduct(String),

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

pub type ZyppServerResult<R> = Result<R, ZyppServerError>;

pub enum SoftwareAction {
    Install(oneshot::Sender<ZyppServerResult<bool>>),
    Finish(oneshot::Sender<ZyppServerResult<()>>),
    GetPatternsMetadata(Vec<String>, oneshot::Sender<ZyppServerResult<Vec<Pattern>>>),
    ComputeProposal(
        ProductSpec,
        oneshot::Sender<ZyppServerResult<SoftwareProposal>>,
    ),
    Write {
        state: SoftwareState,
        progress: Handler<progress::Service>,
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
    },
}

/// Software service server.
pub struct ZyppServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
}

impl ZyppServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate thread and gets the client requests using a channel.
    pub fn start() -> ZyppServerResult<UnboundedSender<SoftwareAction>> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let server = Self { receiver };

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
                tx,
            } => {
                self.write(state, progress, tx, zypp).await?;
            }
            SoftwareAction::GetPatternsMetadata(names, tx) => {
                self.get_patterns(names, tx, zypp).await?;
            }
            SoftwareAction::Install(tx) => {
                tx.send(self.install(zypp))
                    .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            }
            SoftwareAction::Finish(tx) => {
                self.finish(zypp, tx).await?;
            }
            SoftwareAction::ComputeProposal(product_spec, sender) => {
                self.compute_proposal(product_spec, sender, zypp).await?
            }
        }
        Ok(())
    }

    // Install rpms
    fn install(&self, zypp: &zypp_agama::Zypp) -> ZyppServerResult<bool> {
        let target = "/mnt";
        zypp.switch_target(target)?;
        let result = zypp.commit()?;
        tracing::info!("libzypp commit ends with {}", result);
        Ok(result)
    }

    fn read(&self, zypp: &zypp_agama::Zypp) -> Result<SoftwareState, ZyppDispatchError> {
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
            // FIXME: read the real product.
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
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let mut issues: Vec<Issue> = vec![];
        // FIXME:
        // 1. add and remove the repositories.
        // 2. select the patterns.
        // 3. select the packages.
        // 4. return the proposal and the issues.
        // self.add_repositories(state.repositories, tx, &zypp).await?;

        _ = progress.cast(progress::message::StartWithSteps::new(
            Scope::Software,
            &[
                "Updating the list of repositories",
                "Refreshing metadata from the repositories",
                "Calculating the software proposal",
            ],
        ));
        let old_state = self.read(zypp).unwrap();
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

        let to_remove: Vec<_> = state
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
                    Issue::new("software.add_repo", &message, IssueSeverity::Error)
                        .with_details(&error.to_string()),
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
                    Issue::new("software.remove_repo", &message, IssueSeverity::Error)
                        .with_details(&error.to_string()),
                );
            }
        }

        progress.cast(progress::message::Next::new(Scope::Software))?;
        if to_add.is_empty() || to_remove.is_empty() {
            let result = zypp.load_source(|percent, alias| {
                tracing::info!("Refreshing repositories: {} ({}%)", alias, percent);
                true
            });

            if let Err(error) = result {
                let message = format!("Could not read the repositories");
                issues.push(
                    Issue::new("software.load_source", &message, IssueSeverity::Error)
                        .with_details(&error.to_string()),
                );
            }
        }

        _ = progress.cast(progress::message::Next::new(Scope::Software));
        for resolvable_state in &state.resolvables {
            let resolvable = &resolvable_state.resolvable;
            // FIXME: we need to distinguish who is selecting the pattern.
            // and register an issue if it is not found and it was not optional.
            let result = zypp.select_resolvable(
                &resolvable.name,
                resolvable.r#type.into(),
                zypp_agama::ResolvableSelected::Installation,
            );

            if let Err(error) = result {
                let message = format!("Could not select pattern '{}'", &resolvable.name);
                issues.push(
                    Issue::new("software.select_pattern", &message, IssueSeverity::Error)
                        .with_details(&error.to_string()),
                );
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
        self.registration_finish(); // TODO: move it outside of zypp server as it do not need zypp lock
        self.modify_zypp_conf(); // TODO: move it outside of zypp server as it do not need zypp lock

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

    async fn get_patterns(
        &self,
        names: Vec<String>,
        tx: oneshot::Sender<ZyppServerResult<Vec<Pattern>>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let pattern_names = names.iter().map(|n| n.as_str()).collect();
        let patterns = zypp
            .patterns_info(pattern_names)
            .map_err(ZyppServerError::ListPatternsFailed);
        match patterns {
            Err(error) => {
                tx.send(Err(error))
                    .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            }
            Ok(patterns_info) => {
                let patterns = patterns_info
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

                tx.send(Ok(patterns))
                    .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            }
        }

        Ok(())
    }

    fn initialize_target_dir(&self) -> Result<zypp_agama::Zypp, ZyppDispatchError> {
        let target_dir = Path::new(TARGET_DIR);
        if target_dir.exists() {
            _ = std::fs::remove_dir_all(target_dir);
        }

        std::fs::create_dir_all(target_dir).map_err(ZyppDispatchError::TargetCreationFailed)?;

        let zypp = zypp_agama::Zypp::init_target(TARGET_DIR, |text, step, total| {
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

    async fn compute_proposal(
        &self,
        product_spec: ProductSpec,
        sender: oneshot::Sender<Result<SoftwareProposal, ZyppServerError>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        // TODO: for now it just compute total size, but it can get info about partitions from storage and pass it to libzypp
        let mount_points = vec![zypp_agama::MountPoint {
            directory: "/".to_string(),
            filesystem: "btrfs".to_string(),
            grow_only: false, // not sure if it has effect as we install everything fresh
            used_size: 0,
        }];
        let disk_usage = zypp.count_disk_usage(mount_points);
        let Ok(computed_mount_points) = disk_usage else {
            sender
                .send(Err(disk_usage.unwrap_err().into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        };
        let size = computed_mount_points.first().unwrap().used_size;
        // TODO: format size
        let size_str = format!("{size} KiB");

        let selected_patterns: Result<
            std::collections::HashMap<String, SelectedBy>,
            ZyppServerError,
        > = product_spec
            .software
            .user_patterns
            .iter()
            .map(|p| p.name())
            .map(|name| {
                let selected = zypp.is_package_selected(name)?;
                let tag = if selected {
                    SelectedBy::User
                } else {
                    SelectedBy::None
                };
                Ok((name.to_string(), tag))
            })
            .collect();
        let Ok(selected_patterns) = selected_patterns else {
            sender
                .send(Err(selected_patterns.unwrap_err()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        };

        let proposal = SoftwareProposal {
            size: size_str,
            patterns: selected_patterns,
        };

        sender
            .send(Ok(proposal))
            .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
        Ok(())
    }
}
