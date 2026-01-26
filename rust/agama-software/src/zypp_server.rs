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

use agama_security as security;
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
use camino::{Utf8Path, Utf8PathBuf};
use gettextrs::gettext;
use std::{collections::HashMap, fs, os::unix::fs::symlink};
use tokio::sync::{
    mpsc::{self, UnboundedSender},
    oneshot,
};
use zypp_agama::{errors::ZyppResult, ZyppError};

use crate::{
    callbacks,
    model::{
        registration::RegistrationError,
        state::{self, SoftwareState},
    },
    state::{Addon, RegistrationState, ResolvableSelection},
    Registration, ResolvableType,
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

    #[error("SSL error: {0}")]
    SSL(#[from] openssl::error::ErrorStack),

    #[error("Failed to copy file {0}: {1}")]
    IO(String, #[source] std::io::Error),
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
        security: Handler<security::Service>,
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
    },
}

/// Registration status.
#[derive(Default)]
pub enum RegistrationStatus {
    #[default]
    NotRegistered,
    Registered(Registration),
    Failed(RegistrationError),
}

/// Software service server.
pub struct ZyppServer {
    receiver: mpsc::UnboundedReceiver<SoftwareAction>,
    registration: RegistrationStatus,
    root_dir: Utf8PathBuf,
    install_dir: Utf8PathBuf,
}

impl ZyppServer {
    /// Starts the software service loop and returns a client.
    ///
    /// The service runs on a separate thread and gets the client requests using a channel.
    pub fn start<P: AsRef<Utf8Path>>(
        root_dir: P,
        install_dir: P,
    ) -> ZyppServerResult<UnboundedSender<SoftwareAction>> {
        let (sender, receiver) = mpsc::unbounded_channel();

        let server = Self {
            receiver,
            root_dir: root_dir.as_ref().to_path_buf(),
            install_dir: install_dir.as_ref().to_path_buf(),
            registration: Default::default(),
        };

        // drop the returned JoinHandle: the thread will be detached
        // but that's OK for it to run until the process dies
        std::thread::spawn(move || server.run());
        Ok(sender)
    }

    /// Runs the server dispatching the actions received through the input channel.
    fn run(mut self) -> Result<(), ZyppDispatchError> {
        let zypp = self.initialize_target_dir()?;

        loop {
            // what happens here is that we need synchronized code
            // and only for small async interface run it in blocking way. Receiver handling is done to explicit passing
            // of ownership as receiver do not implement Copy.
            // It creates own runtime here as we are on dedicated zypp thread and there is no tokio runtime yet. So we
            // create a new one with single thread to run tasks in its own dedicated thread.
            // unwrap OK: unwrap is fine as if we eat all IO resources, we are doomed, so failing is good solution
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            let res = rt.spawn(async move { (self.receiver.recv().await, self.receiver) });
            // unwrap OK: receiver hopefuly should not panic when just receiving message
            let (action, receiver) = rt.block_on(res).unwrap();
            self.receiver = receiver;

            let Some(action) = action else {
                tracing::info!("Software action channel closed. So time for rest in peace.");
                break;
            };

            if let Err(error) = self.dispatch(action, &zypp) {
                tracing::error!("Software dispatch error: {:?}", error);
            }
        }

        Ok(())
    }

    /// Forwards the action to the appropriate handler.
    fn dispatch(
        &mut self,
        action: SoftwareAction,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        match action {
            SoftwareAction::Write {
                state,
                progress,
                question,
                security: security_srv,
                tx,
            } => {
                let mut security_callback = callbacks::Security::new(question.clone());
                self.write(
                    state,
                    progress,
                    question,
                    security_srv,
                    &mut security_callback,
                    tx,
                    zypp,
                )?;
            }
            SoftwareAction::GetSystemInfo(product_spec, tx) => {
                self.system_info(product_spec, tx, zypp)?;
            }
            SoftwareAction::Install(tx, progress, question) => {
                tx.send(self.install(zypp, progress, question))
                    .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            }
            SoftwareAction::Finish(tx) => {
                self.finish(zypp, tx)?;
            }
            SoftwareAction::GetProposal(product_spec, sender) => {
                self.proposal(product_spec, sender, zypp)?
            }
        }
        Ok(())
    }

    // Install rpms
    fn install(
        &self,
        zypp: &zypp_agama::Zypp,
        progress: Handler<progress::Service>,
        question: Handler<question::Service>,
    ) -> ZyppServerResult<bool> {
        let mut download_callback =
            callbacks::CommitDownload::new(progress.clone(), question.clone());
        let mut install_callback = callbacks::Install::new(progress.clone(), question.clone());
        let mut security_callback = callbacks::Security::new(question);

        let packages_count = zypp.packages_count();
        // use packages count *2 as we need to download package and also install it
        let steps = (packages_count * 2) as usize;
        let _ = progress.cast(progress::message::Start::new(
            Scope::Software,
            steps,
            "Starting packages installation",
        ));

        zypp.switch_target(&self.install_dir.to_string())?;
        let result = zypp.commit(
            &mut download_callback,
            &mut install_callback,
            &mut security_callback,
        )?;
        tracing::info!("libzypp commit ends with {}", result);
        let res = progress.cast(progress::message::Finish::new(Scope::Software));
        tracing::info!("Software install finished. Progress result {:#?}", res);
        Ok(result)
    }

    fn read(&self, zypp: &zypp_agama::Zypp) -> Result<SoftwareState, ZyppError> {
        let repositories = zypp
            .list_repositories()?
            .into_iter()
            // filter out service managed repositories
            .filter(|repo| repo.service.is_none())
            .map(|repo| state::Repository {
                name: repo.user_name,
                alias: repo.alias,
                url: repo.url,
                enabled: repo.enabled,
            })
            .collect();

        // FIXME: read the real product. It is not a problem because it is replaced
        // later.
        let mut state = SoftwareState::new("SLES");
        state.repositories = repositories;
        Ok(state)
    }

    fn write(
        &mut self,
        state: SoftwareState,
        progress: Handler<progress::Service>,
        questions: Handler<question::Service>,
        security_srv: Handler<security::Service>,
        security: &mut callbacks::Security,
        tx: oneshot::Sender<ZyppServerResult<Vec<Issue>>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let mut issues: Vec<Issue> = vec![];
        let mut steps = vec![
            gettext("Updating the list of repositories"),
            gettext("Refreshing metadata from the repositories"),
            gettext("Calculating the software proposal"),
        ];
        if state.registration.is_some() {
            steps.insert(0, gettext("Registering the system"));
        }

        _ = progress.cast(progress::message::StartWithSteps::new(
            Scope::Software,
            steps,
        ));

        // TODO: add information about the current registration state
        let old_state = self.read(zypp)?;

        if let Some(registration_config) = &state.registration {
            self.update_registration(registration_config, &zypp, &security_srv, &mut issues);
        }

        progress.cast(progress::message::Next::new(Scope::Software))?;
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
            let issue = if state.allow_registration {
                Issue::new(
                    "software.missing_registration",
                    &gettext("The product must be registered"),
                )
            } else {
                let message = format!("Could not select the product '{}'", &state.product);
                Issue::new("software.missing_product", &message).with_details(&error.to_string())
            };
            issues.push(issue);
        }
        for (name, r#type, selection) in &state.resolvables.to_vec() {
            match selection {
                ResolvableSelection::AutoSelected { optional } => {
                    issues.append(&mut self.select_resolvable(
                        &zypp,
                        name,
                        *r#type,
                        zypp_agama::ResolvableSelected::Installation,
                        *optional,
                    ));
                }
                ResolvableSelection::Selected => {
                    issues.append(&mut self.select_resolvable(
                        &zypp,
                        name,
                        *r#type,
                        zypp_agama::ResolvableSelected::User,
                        false,
                    ));
                }
                // the removal is handled in a separate iteration to unselect resolvables selected
                // by dependencies
                ResolvableSelection::Removed => {}
            };
        }

        // run the solver to select the dependencies, ignore the errors, the solver runs again later
        let _ = zypp.run_solver();

        // unselect packages including the autoselected dependencies
        for (name, r#type, selection) in &state.resolvables.to_vec() {
            match selection {
                ResolvableSelection::Removed => self.unselect_resolvable(&zypp, name, *r#type),
                _ => {}
            };
        }

        _ = progress.cast(progress::message::Finish::new(Scope::Software));
        match zypp.run_solver() {
            Ok(result) => println!("Solver result: {result}"),
            Err(error) => println!("Solver failed: {error}"),
        };

        if let Err(e) = tx.send(Ok(issues)) {
            tracing::error!("failed to send list of issues after write: {:?}", e);
            // It is OK to return ok, when tx is closed, we have no other way to indicate issue.
        }
        Ok(())
    }

    fn select_resolvable(
        &self,
        zypp: &zypp_agama::Zypp,
        name: &str,
        r#type: ResolvableType,
        reason: zypp_agama::ResolvableSelected,
        optional: bool,
    ) -> Vec<Issue> {
        let mut issues = vec![];
        let result = zypp.select_resolvable(name, r#type.into(), reason);

        if let Err(error) = result {
            if optional {
                tracing::info!("Could not select '{}' but it is optional.", name);
            } else {
                let message = format!("Could not select '{}'", name);
                issues.push(
                    Issue::new("software.select_resolvable", &message)
                        .with_details(&error.to_string()),
                );
            }
        }
        issues
    }

    fn unselect_resolvable(&self, zypp: &zypp_agama::Zypp, name: &str, r#type: ResolvableType) {
        if let Err(error) =
            zypp.unselect_resolvable(name, r#type.into(), zypp_agama::ResolvableSelected::User)
        {
            tracing::info!("Could not unselect '{name}': {error}");
        }
    }

    fn finish(
        &mut self,
        zypp: &zypp_agama::Zypp,
        tx: oneshot::Sender<ZyppServerResult<()>>,
    ) -> Result<(), ZyppDispatchError> {
        if let Err(error) = self.remove_dud_repo(zypp) {
            tracing::warn!("Failed to remove the DUD repository: {error}");
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        if let Err(error) = self.disable_local_repos(zypp) {
            tracing::warn!("Failed to disable local repositories: {error}");
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        let _ = self.registration_finish(); // TODO: move it outside of zypp server as it do not need zypp lock
        let _ = self.modify_zypp_conf(); // TODO: move it outside of zypp server as it do not need zypp lock

        if let Err(error) = self.modify_full_repo(zypp) {
            tracing::warn!("Failed to modify the full repository: {error}");
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }
        if let Err(error) = self.copy_files() {
            tracing::warn!("Failed to copy zypp files: {error}");
            tx.send(Err(error.into()))
                .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
            return Ok(());
        }

        // if we fail to send ok, lets just ignore it
        let _ = tx.send(Ok(()));
        Ok(())
    }

    const ZYPP_DIRS: [&str; 4] = [
        "etc/zypp/services.d",
        "etc/zypp/repos.d",
        "etc/zypp/credentials.d",
        "var/cache/zypp",
    ];
    fn copy_files(&self) -> ZyppServerResult<()> {
        for path in Self::ZYPP_DIRS {
            let source_path = self.root_dir.join(path);
            let target_path = self.install_dir.join(path);
            if source_path.exists() {
                self.copy_dir_all(&source_path, &target_path)?;
            }
        }
        Ok(())
    }

    fn copy_dir_all(&self, source: &Utf8Path, target: &Utf8Path) -> ZyppServerResult<()> {
        fs::create_dir_all(&target).map_err(|e| ZyppServerError::IO(target.to_string(), e))?;
        for entry in source
            .read_dir_utf8()
            .map_err(|e| ZyppServerError::IO(source.to_string(), e))?
        {
            let entry = entry.map_err(|e| ZyppServerError::IO(source.to_string(), e))?;
            let ty = fs::symlink_metadata(entry.path())
                .map_err(|e| ZyppServerError::IO(entry.path().to_string(), e))?;
            let dst = target.join(entry.file_name());
            if ty.is_dir() {
                self.copy_dir_all(entry.path(), &dst)?;
            } else if ty.is_symlink() {
                // we need special handling of symlinks as libzypp do
                // some tricks with danglinks symlinks and we should not
                // break it
                let link_dest = entry
                    .path()
                    .read_link_utf8()
                    .map_err(|e| ZyppServerError::IO(entry.path().to_string(), e))?;
                tracing::info!(
                    "Recreating symlink from {} to {} pointing to {}",
                    entry.path().to_string(),
                    dst.to_string(),
                    link_dest.to_string(),
                );
                symlink(link_dest, &dst).map_err(|e| ZyppServerError::IO(dst.to_string(), e))?;
            } else {
                tracing::info!(
                    "Copying from {} to {}",
                    entry.path().to_string(),
                    dst.to_string()
                );
                fs::copy(entry.path(), &dst)
                    .map_err(|e| ZyppServerError::IO(entry.path().to_string(), e))?;
            }
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

    fn registration_finish(&mut self) -> ZyppServerResult<()> {
        let RegistrationStatus::Registered(registration) = &mut self.registration else {
            tracing::info!(
                "Skipping the copy of registration files because the system was not registered"
            );
            return Ok(());
        };

        if let Err(error) = registration.finish(&self.install_dir) {
            // just log error and continue as registration config is recoverable
            tracing::error!("Failed to finish the registration: {error}");
        };
        Ok(())
    }

    fn modify_zypp_conf(&self) -> ZyppServerResult<()> {
        // TODO: implement when requireOnly is implemented
        Ok(())
    }

    fn system_info(
        &self,
        product: ProductSpec,
        tx: oneshot::Sender<ZyppServerResult<SystemInfo>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let patterns = self.patterns(&product, zypp)?;
        let repositories = self.repositories(zypp)?;
        // let registration = self.registration.as_ref().map(|r| r.to_registration_info());
        let registration = match &self.registration {
            RegistrationStatus::Registered(registration) => {
                Some(registration.to_registration_info())
            }
            _ => None,
        };

        let system_info = SystemInfo {
            patterns,
            repositories,
            registration,
        };

        tx.send(Ok(system_info))
            .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
        Ok(())
    }

    fn patterns(&self, product: &ProductSpec, zypp: &zypp_agama::Zypp) -> ZyppResult<Vec<Pattern>> {
        let pattern_names: Vec<_> = product
            .software
            .user_patterns
            .iter()
            .map(|p| p.name())
            .collect();

        let preselected_patterns: Vec<_> = product
            .software
            .user_patterns
            .iter()
            .filter(|p| p.preselected())
            .map(|p| p.name())
            .collect();

        let patterns = zypp.patterns_info(pattern_names)?;

        let patterns = patterns
            .into_iter()
            .map(|p| {
                let preselected = preselected_patterns.contains(&p.name.as_str());
                Pattern {
                    name: p.name,
                    category: p.category,
                    description: p.description,
                    icon: p.icon,
                    summary: p.summary,
                    order: p.order,
                    preselected,
                }
            })
            .collect();
        Ok(patterns)
    }

    fn repositories(&self, zypp: &zypp_agama::Zypp) -> ZyppResult<Vec<api::software::Repository>> {
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
        if target_dir.exists() {
            _ = std::fs::remove_dir_all(target_dir);
        }

        std::fs::create_dir_all(target_dir.as_str())
            .map_err(ZyppDispatchError::TargetCreationFailed)?;

        let zypp = zypp_agama::Zypp::init_target(target_dir.as_str(), |text, step, total| {
            tracing::info!("Initializing target: {} ({}/{})", text, step, total);
        })?;

        self.import_gpg_keys(&zypp);
        tracing::info!("zypp initialized");
        Ok(zypp)
    }

    fn import_gpg_keys(&self, zypp: &zypp_agama::Zypp) {
        // unwrap OK: glob pattern is created by us
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

    fn proposal(
        &self,
        product: ProductSpec,
        tx: oneshot::Sender<ZyppServerResult<SoftwareProposal>>,
        zypp: &zypp_agama::Zypp,
    ) -> Result<(), ZyppDispatchError> {
        let proposal = SoftwareProposal {
            used_space: self.used_space(&zypp)?,
            patterns: self.patterns_selection(&product, &zypp)?,
        };

        tx.send(Ok(proposal))
            .map_err(|_| ZyppDispatchError::ResponseChannelClosed)?;
        Ok(())
    }

    fn used_space(&self, zypp: &zypp_agama::Zypp) -> Result<i64, ZyppServerError> {
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

    fn patterns_selection(
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
                            zypp_agama::ResolvableSelected::Removed => SelectedBy::Removed,
                        };
                        (pattern.name.clone(), tag)
                    })
                    .collect()
            })
            .map_err(|e| e.into())
    }

    /// Update the registration status.
    ///
    /// Register the system and the add-ons. If it was not possible to register the system
    /// on a previous call to this function, do not try again. Otherwise, it might fail
    /// again.
    ///
    /// - `state`: wanted registration state.
    /// - `zypp`: zypp instance.
    /// - `issues`: list of issues to update.
    fn update_registration(
        &mut self,
        state: &RegistrationState,
        zypp: &zypp_agama::Zypp,
        security_srv: &Handler<security::Service>,
        issues: &mut Vec<Issue>,
    ) {
        match &self.registration {
            RegistrationStatus::Failed(_) | RegistrationStatus::NotRegistered => {
                self.register_base_system(state, zypp, security_srv, issues);
            }
            RegistrationStatus::Registered(_) => {}
        };

        if !state.addons.is_empty() {
            self.register_addons(&state.addons, zypp, issues);
        }
    }

    fn register_base_system(
        &mut self,
        state: &RegistrationState,
        zypp: &zypp_agama::Zypp,
        security_srv: &Handler<security::Service>,
        issues: &mut Vec<Issue>,
    ) {
        let mut registration =
            Registration::builder(self.root_dir.clone(), &state.product, &state.version);

        if let Some(code) = &state.code {
            registration = registration.with_code(code);
        }

        if let Some(email) = &state.email {
            registration = registration.with_email(email);
        }

        if let Some(url) = &state.url {
            registration = registration.with_url(url);
        }

        match registration.register(&zypp, security_srv) {
            Ok(registration) => {
                self.registration = RegistrationStatus::Registered(registration);
            }
            Err(error) => {
                issues.push(
                    Issue::new(
                        "system_registration_failed",
                        "Failed to register the system",
                    )
                    .with_details(&error.to_string()),
                );
                self.registration = RegistrationStatus::Failed(error);
            }
        }
    }

    fn register_addons(
        &mut self,
        addons: &Vec<Addon>,
        zypp: &zypp_agama::Zypp,
        issues: &mut Vec<Issue>,
    ) {
        let RegistrationStatus::Registered(registration) = &mut self.registration else {
            tracing::error!("Could not register addons because the base system is not registered");
            return;
        };

        for addon in addons {
            if registration.is_addon_registered(&addon) {
                tracing::info!("Skipping already registered add-on {}", &addon.id);
                continue;
            }
            if let Err(error) = registration.register_addon(zypp, addon) {
                let message = format!("Failed to register the add-on {}", addon.id);
                let issue_id = format!("addon_registration_failed[{}]", &addon.id);
                let issue = Issue::new(&issue_id, &message).with_details(&error.to_string());
                issues.push(issue);
            }
        }
    }
}
