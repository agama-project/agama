// Copyright (c) [2025-2026] SUSE LLC
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

use agama_network::NetworkSystemClient;
use agama_utils::{
    actor::Handler,
    api::{files::scripts::ScriptsGroup, status::Stage, Config, FinishMethod, Scope},
    issue,
    products::ProductSpec,
    progress, question,
};
use gettextrs::gettext;
use tokio::sync::RwLock;

use crate::{
    bootloader, checks, files, hostname, ipmi::Ipmi, iscsi, l10n, ntp, proxy, s390, security,
    service, software, storage,
    task_manager::{task_error, TaskManager},
    users,
};

/// Implements the installation process.
///
/// This action runs on a separate Tokio task to prevent the manager from blocking.
pub struct InstallAction {
    pub hostname: Handler<hostname::Service>,
    pub issues: Handler<issue::Service>,
    pub l10n: Handler<l10n::Service>,
    pub network: NetworkSystemClient,
    pub proxy: Handler<proxy::Service>,
    pub ntp: Handler<ntp::Service>,
    pub remote_access: Handler<agama_remote::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub files: Handler<files::Service>,
    pub progress: Handler<progress::Service>,
    pub users: Handler<users::Service>,
}

impl InstallAction {
    /// Runs the installation process on a separate Tokio task.
    pub async fn run(mut self) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;
        checks::check_issues(&self.issues).await?;
        checks::check_progress(&self.progress).await?;

        tracing::info!("Installation started");
        if let Err(error) = self.install().await {
            tracing::error!("Installation failed: {error}");
            self.set_stage(Stage::Failed).await;
            return Err(error);
        }

        tracing::info!("Installation finished");
        Ok(())
    }

    async fn install(&mut self) -> Result<(), service::Error> {
        // NOTE: consider a NextState message?
        self.progress
            .call(progress::message::SetStage::new(Stage::Installing))
            .await?;

        //
        // Preparation
        //
        self.progress
            .call(progress::message::StartWithSteps::new(
                Scope::Manager,
                vec![
                    gettext("Prepare the system"),
                    gettext("Install software"),
                    gettext("Configure the system"),
                ],
            ))
            .await?;

        self.storage.call(storage::message::Install).await?;
        self.files
            .call(files::message::RunScripts::new(
                ScriptsGroup::PostPartitioning,
            ))
            .await?;

        //
        // Installation
        //
        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.software.call(software::message::Install).await?;

        //
        // Configuration
        //
        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.l10n.call(l10n::message::Install).await?;
        self.software.call(software::message::Finish).await?;
        self.files.call(files::message::Finish).await?;
        self.network.install().await?;
        self.proxy.call(proxy::message::Finish).await?;
        self.ntp.call(ntp::message::Finish).await?;
        self.hostname.call(hostname::message::Install).await?;
        self.users.call(users::message::Install).await?;
        self.storage.call(storage::message::Finish).await?;
        self.remote_access
            .call(agama_remote::message::Finish)
            .await?;

        // call files as last finish so all configs are in place,
        // but before unmout of /mnt/run which is important for chrooted scripts (bsc#1257791)
        self.files
            .call(files::message::RunScripts::new(ScriptsGroup::Post))
            .await?;

        self.storage.call(storage::message::Umount).await?;

        //
        // Finish progress and changes
        //
        self.progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await?;

        self.progress
            .call(progress::message::SetStage::new(Stage::Finished))
            .await?;
        Ok(())
    }

    async fn set_stage(&self, stage: Stage) {
        if let Err(error) = self
            .progress
            .call(progress::message::SetStage::new(stage))
            .await
        {
            tracing::error!("It was not possible to set the stage to {}: {error}", stage);
        }
    }
}

/// Implements the set config logic.
///
/// This action runs on a separate Tokio task to prevent the manager from blocking.
pub struct SetConfigAction {
    pub bootloader: Handler<bootloader::Service>,
    pub files: Handler<files::Service>,
    pub hostname: Handler<hostname::Service>,
    pub iscsi: Handler<iscsi::Service>,
    pub l10n: Handler<l10n::Service>,
    pub network: NetworkSystemClient,
    pub proxy: Handler<proxy::Service>,
    pub ntp: Handler<ntp::Service>,
    pub progress: Handler<progress::Service>,
    pub questions: Handler<question::Service>,
    pub remote_access: Handler<agama_remote::Service>,
    pub security: Handler<security::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub users: Handler<users::Service>,
    pub s390: Option<Handler<s390::Service>>,
    pub task_manager: Arc<TaskManager>,
}

impl SetConfigAction {
    /// Helper to spawn a task for a config message call
    async fn spawn_config_task<S, M>(
        &self,
        id: &str,
        description: &str,
        handler: Handler<S>,
        message: M,
    ) where
        S: agama_utils::actor::MessageHandler<M> + 'static,
        M: agama_utils::actor::Message<Reply = ()> + Send + 'static,
        S::Error: std::error::Error + Send + 'static,
    {
        self.task_manager
            .task(id, description)
            .run(|| async move { handler.call(message).await.map_err(task_error) })
            .await;
    }

    pub async fn run(
        self,
        product: Option<Arc<RwLock<ProductSpec>>>,
        config: Config,
    ) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;

        // Security settings
        self.spawn_config_task(
            "security",
            &gettext("Storing security settings"),
            self.security.clone(),
            security::message::SetConfig::new(config.security.clone()),
        )
        .await;

        // Remote access
        self.spawn_config_task(
            "remote_access",
            &gettext("Configuring remote access"),
            self.remote_access.clone(),
            agama_remote::message::SetConfig::new(config.remote_access.clone()),
        )
        .await;

        // Hostname
        self.spawn_config_task(
            "hostname",
            &gettext("Setting up the hostname"),
            self.hostname.clone(),
            hostname::message::SetConfig::new(config.hostname.clone()),
        )
        .await;

        // Proxy
        self.spawn_config_task(
            "proxy",
            &gettext("Setting up the network proxy"),
            self.proxy.clone(),
            proxy::message::SetConfig::new(config.proxy.clone()),
        )
        .await;

        // NTP
        self.spawn_config_task(
            "ntp",
            &gettext("Setting up NTP"),
            self.ntp.clone(),
            ntp::message::SetConfig::new(config.ntp.clone()),
        )
        .await;

        // Files configuration
        self.spawn_config_task(
            "files_config",
            &gettext("Importing user files"),
            self.files.clone(),
            files::message::SetConfig::new(config.files.clone()),
        )
        .await;

        // Pre-installation scripts
        let files_handler = self.files.clone();
        self.task_manager
            .task(
                "pre_scripts",
                &gettext("Running user pre-installation scripts"),
            )
            .run(move || async move {
                files_handler
                    .call(files::message::RunScripts::new(ScriptsGroup::Pre))
                    .await
                    .map(|_| ())
                    .map_err(task_error)
            })
            .await;

        // Questions settings
        self.spawn_config_task(
            "questions",
            &gettext("Storing questions settings"),
            self.questions.clone(),
            question::message::SetConfig::new(config.questions.clone()),
        )
        .await;

        // L10n settings
        self.spawn_config_task(
            "l10n",
            &gettext("Storing localization settings"),
            self.l10n.clone(),
            l10n::message::SetConfig::new(config.l10n.clone()),
        )
        .await;

        // Users settings
        self.spawn_config_task(
            "users",
            &gettext("Storing users settings"),
            self.users.clone(),
            users::message::SetConfig::new(config.users.clone()),
        )
        .await;

        // iSCSI configuration
        self.spawn_config_task(
            "iscsi",
            &gettext("Configuring iSCSI devices"),
            self.iscsi.clone(),
            iscsi::message::SetConfig::new(config.iscsi.clone()),
        )
        .await;

        // S390 configuration (if available)
        if let Some(s390) = &self.s390 {
            let handler = s390.clone();
            let s390_config = config.s390.clone();
            let storage_handler = self.storage.clone();
            self.task_manager
                .task("s390", &gettext("Configuring DASD devices"))
                .run(|| async move {
                    // Ensure storage was already probed before configuring s390
                    let storage_system = storage_handler
                        .call(storage::message::GetSystem)
                        .await
                        .map_err(task_error)?;
                    if storage_system.is_none() {
                        storage_handler
                            .call(storage::message::Probe)
                            .await
                            .map_err(task_error)?
                    }
                    handler
                        .call(s390::message::SetConfig::new(s390_config))
                        .await
                        .map_err(task_error)
                })
                .await;
        }

        // Network configuration
        if config.network.is_some() {
            let handler = self.network.clone();
            let network_config = config.network.clone().unwrap();
            self.task_manager
                .task("network", &gettext("Setting up the network"))
                .run(|| async move {
                    handler
                        .update_config(network_config)
                        .await
                        .map_err(task_error)?;
                    handler.apply().await.map_err(task_error)
                })
                .await;
        }

        // Product-dependent configuration (software, storage, bootloader)
        if let Some(product) = product {
            // Software configuration
            self.spawn_config_task(
                "software",
                &gettext("Preparing the software proposal"),
                self.software.clone(),
                software::message::SetConfig::new(Arc::clone(&product), config.software.clone()),
            )
            .await;

            // SELinux configuration
            let selinux_selected = self
                .software
                .call(software::message::IsPatternSelected::new(
                    "selinux".to_string(),
                ))
                .await?;

            let value = if selinux_selected {
                "security=selinux"
            } else {
                "security="
            };
            let message = agama_bootloader::message::SetKernelArg {
                id: "selinux".to_string(),
                value: value.to_string(),
            };

            if let Err(error) = self.bootloader.cast(message) {
                tracing::warn!("Failed to send to bootloader new selinux state: {error:?}");
            }

            // Storage configuration
            let handler = self.storage.clone();
            let product_clone = Arc::clone(&product);
            let storage_config = config.storage.clone();
            self.task_manager
                .task("storage", &gettext("Preparing the storage proposal"))
                .run(|| async move {
                    let future = handler
                        .call(storage::message::SetConfig::new(
                            product_clone,
                            storage_config,
                        ))
                        .await
                        .map_err(task_error)?;
                    let _ = future.await;
                    Ok(())
                })
                .await;

            // Bootloader configuration (after storage)
            self.spawn_config_task(
                "bootloader",
                &gettext("Storing bootloader settings"),
                self.bootloader.clone(),
                bootloader::message::SetConfig::new(config.bootloader.clone()),
            )
            .await;
        }

        Ok(())
    }

    async fn set_network(&self, config: &Config) -> Result<(), service::Error> {
        let Some(network) = config.network.clone() else {
            return Ok(());
        };

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.network.update_config(network).await?;
        self.network.apply().await?;

        Ok(())
    }

    // Enables/Disables SELinux in the installed system.
    //
    // If the "selinux" pattern is selected, set the "security=selinux" boot
    // kernel parameter.
    //
    // NOTE: this logic should live in another place, like "agama-security".
    // It is temporarily here to fix bsc#1259890.
    async fn set_selinux(&self) -> Result<(), service::Error> {
        let selinux_selected = self
            .software
            .call(software::message::IsPatternSelected::new(
                "selinux".to_string(),
            ))
            .await?;

        let value = if selinux_selected {
            "security=selinux"
        } else {
            "security="
        };
        let message = agama_bootloader::message::SetKernelArg {
            id: "selinux".to_string(),
            value: value.to_string(),
        };

        if let Err(error) = self.bootloader.cast(message) {
            tracing::warn!("Failed to send to bootloader new selinux state: {error:?}");
        }

        Ok(())
    }
}

/// Implements the finish action.
///
/// If no FinishMethod is given, it defaults to "Stop" (which basically menans to do nothing).
pub struct FinishAction {
    method: FinishMethod,
}

impl FinishAction {
    pub fn new(method: FinishMethod) -> Self {
        Self { method }
    }

    pub fn run(self) {
        tracing::info!("Finishing the installation process ({})", self.method);

        let option = match self.method {
            FinishMethod::Halt => Some("-H"),
            FinishMethod::Reboot => Some("-r"),
            FinishMethod::Poweroff => Some("-P"),
            FinishMethod::Stop => None,
        };
        let mut command = Command::new("shutdown");

        if let Some(switch) = option {
            command.arg(switch);
        } else {
            return;
        }

        command.arg("now");

        if let Err(e) = Ipmi::default().finished() {
            tracing::error!("IPMI failed: {}", e);
        }

        match command.output() {
            Ok(output) => {
                if !output.status.success() {
                    tracing::error!("Failed to shutdown the system: {output:?}")
                }
            }
            Err(error) => {
                tracing::error!("Failed to run the shutdown command: {error}");
            }
        }
    }
}
