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
    service, software, storage, task_manager::TaskManager, users,
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
    pub async fn run(
        self,
        product: Option<Arc<RwLock<ProductSpec>>>,
        config: Config,
    ) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;

        // Security settings
        let handler = self.security.clone();
        let security_config = config.security.clone();
        self.task_manager
            .task("security", &gettext("Storing security settings"))
            .run(|| async move {
                handler
                    .call(security::message::SetConfig::new(security_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Remote access
        let handler = self.remote_access.clone();
        let access_config = config.remote_access.clone();
        self.task_manager
            .task("remote_access", &gettext("Configuring remote access"))
            .run(|| async move {
                handler
                    .call(agama_remote::message::SetConfig::new(access_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Hostname
        let handler = self.hostname.clone();
        let hostname_config = config.hostname.clone();
        self.task_manager
            .task("hostname", &gettext("Setting up the hostname"))
            .run(|| async move {
                handler
                    .call(hostname::message::SetConfig::new(hostname_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Proxy
        let handler = self.proxy.clone();
        let proxy_config = config.proxy.clone();
        self.task_manager
            .task("proxy", &gettext("Setting up the network proxy"))
            .run(|| async move {
                handler
                    .call(proxy::message::SetConfig::new(proxy_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // NTP
        let handler = self.ntp.clone();
        let ntp_config = config.ntp.clone();
        self.task_manager
            .task("ntp", &gettext("Setting up NTP"))
            .run(|| async move {
                handler
                    .call(ntp::message::SetConfig::new(ntp_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Files configuration
        let handler = self.files.clone();
        let files_config = config.files.clone();
        self.task_manager
            .task("files_config", &gettext("Importing user files"))
            .run(|| async move {
                handler
                    .call(files::message::SetConfig::new(files_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Pre-installation scripts
        let handler = self.files.clone();
        self.task_manager
            .task(
                "pre_scripts",
                &gettext("Running user pre-installation scripts"),
            )
            .run(|| async move {
                handler
                    .call(files::message::RunScripts::new(ScriptsGroup::Pre))
                    .await
                    .map(|_| ())
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Questions settings
        let handler = self.questions.clone();
        let questions_config = config.questions.clone();
        self.task_manager
            .task("questions", &gettext("Storing questions settings"))
            .run(|| async move {
                handler
                    .call(question::message::SetConfig::new(questions_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // L10n settings
        let handler = self.l10n.clone();
        let l10n_config = config.l10n.clone();
        self.task_manager
            .task("l10n", &gettext("Storing localization settings"))
            .run(|| async move {
                handler
                    .call(l10n::message::SetConfig::new(l10n_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // Users settings
        let handler = self.users.clone();
        let users_config = config.users.clone();
        self.task_manager
            .task("users", &gettext("Storing users settings"))
            .run(|| async move {
                handler
                    .call(users::message::SetConfig::new(users_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
            .await;

        // iSCSI configuration
        let handler = self.iscsi.clone();
        let iscsi_config = config.iscsi.clone();
        self.task_manager
            .task("iscsi", &gettext("Configuring iSCSI devices"))
            .run(|| async move {
                handler
                    .call(iscsi::message::SetConfig::new(iscsi_config))
                    .await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
            })
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
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)?;
                    if storage_system.is_none() {
                        storage_handler
                            .call(storage::message::Probe)
                            .await
                            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)?
                    }
                    handler
                        .call(s390::message::SetConfig::new(s390_config))
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
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
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)?;
                    handler
                        .apply()
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
                })
                .await;
        }

        // Product-dependent configuration (software, storage, bootloader)
        if let Some(product) = product {
            // Software configuration
            let handler = self.software.clone();
            let product_clone = Arc::clone(&product);
            let software_config = config.software.clone();
            self.task_manager
                .task("software", &gettext("Preparing the software proposal"))
                .run(|| async move {
                    handler
                        .call(software::message::SetConfig::new(
                            product_clone,
                            software_config,
                        ))
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
                })
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
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)?;
                    let _ = future.await;
                    Ok(())
                })
                .await;

            // Bootloader configuration (after storage)
            let handler = self.bootloader.clone();
            let bootloader_config = config.bootloader.clone();
            self.task_manager
                .task("bootloader", &gettext("Storing bootloader settings"))
                .run(|| async move {
                    handler
                        .call(bootloader::message::SetConfig::new(bootloader_config))
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send>)
                })
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
