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

use crate::{
    bootloader, checks, files, hostname,
    ipmi::Ipmi,
    iscsi, l10n, ntp, proxy, s390, security, service, software, storage,
    task_manager::{self, TaskError, TaskManager},
    users,
};
use agama_network::NetworkSystemClient;
use agama_utils::{
    actor::{Handler, MessageHandler},
    api::{files::scripts::ScriptsGroup, status::Stage, Config, FinishMethod, Scope},
    issue,
    message::GetResolvables,
    products::ProductSpec,
    progress, question,
};
use gettextrs::gettext;
use std::{process::Command, sync::Arc};
use tokio::sync::RwLock;

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
    pub access: Handler<agama_access::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub files: Handler<files::Service>,
    pub progress: Handler<progress::Service>,
    pub users: Handler<users::Service>,
    pub task_manager: Arc<TaskManager>,
}

impl InstallAction {
    /// Runs the installation process by spawning tasks via TaskManager.
    pub async fn run(self) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;
        checks::check_issues(&self.issues).await?;
        checks::check_progress(&self.progress).await?;

        tracing::info!("Installation started");

        self.progress
            .call(progress::message::SetStage::new(Stage::Installing))
            .await?;

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

        //
        // Preparation phase
        //
        let storage_task = {
            let storage = self.storage.clone();
            self.task_manager
                .task(
                    "storage_install",
                    Scope::Storage,
                    gettext("Preparing storage"),
                )
                .run(|| async move {
                    storage
                        .call(storage::message::Install)
                        .await
                        .map_err(TaskError::from_error)?;
                    Ok(())
                })
                .await
        };

        let post_part_scripts_task = {
            let files = self.files.clone();
            self.task_manager
                .task(
                    "post_partitioning_scripts",
                    Scope::Files,
                    gettext("Running post-partitioning scripts"),
                )
                .depends_on(&[storage_task])
                .run(|| async move {
                    files
                        .call(files::message::RunScripts::new(
                            ScriptsGroup::PostPartitioning,
                        ))
                        .await
                        .map_err(TaskError::from_error)?;
                    Ok(())
                })
                .await
        };

        //
        // Installation phase
        //
        let software_task = {
            let software = self.software.clone();
            let progress = self.progress.clone();
            self.task_manager
                .task(
                    "software_install",
                    Scope::Software,
                    gettext("Installing software"),
                )
                .depends_on(&[post_part_scripts_task])
                .run(|| async move {
                    progress
                        .call(progress::message::Next::new(Scope::Manager))
                        .await
                        .map_err(TaskError::from_error)?;
                    software
                        .call(software::message::Install)
                        .await
                        .map_err(TaskError::from_error)?;
                    Ok(())
                })
                .await
        };

        //
        // Configuration phase - runs sequentially
        //
        let config_task = {
            let l10n = self.l10n.clone();
            let software = self.software.clone();
            let files = self.files.clone();
            let network = self.network.clone();
            let proxy = self.proxy.clone();
            let ntp = self.ntp.clone();
            let hostname = self.hostname.clone();
            let users = self.users.clone();
            let storage = self.storage.clone();
            let access = self.access.clone();
            let progress = self.progress.clone();

            self.task_manager
                .task(
                    "configure",
                    Scope::Manager,
                    gettext("Configuring the system"),
                )
                .depends_on(&[software_task])
                .run(|| async move {
                    progress
                        .call(progress::message::Next::new(Scope::Manager))
                        .await
                        .map_err(TaskError::from_error)?;
                    l10n.call(l10n::message::Install)
                        .await
                        .map_err(TaskError::from_error)?;
                    software
                        .call(software::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;
                    files
                        .call(files::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;
                    network.install().await.map_err(TaskError::from_error)?;
                    proxy
                        .call(proxy::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;
                    ntp.call(ntp::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;
                    hostname
                        .call(hostname::message::Install)
                        .await
                        .map_err(TaskError::from_error)?;
                    users
                        .call(users::message::Install)
                        .await
                        .map_err(TaskError::from_error)?;
                    storage
                        .call(storage::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;
                    access
                        .call(agama_access::message::Finish)
                        .await
                        .map_err(TaskError::from_error)?;

                    // call files as last finish so all configs are in place,
                    // but before unmount of /mnt/run which is important for chrooted scripts (bsc#1257791)
                    files
                        .call(files::message::RunScripts::new(ScriptsGroup::Post))
                        .await
                        .map_err(TaskError::from_error)?;

                    storage
                        .call(storage::message::Umount)
                        .await
                        .map_err(TaskError::from_error)?;

                    Ok(())
                })
                .await
        };

        // Final progress and stage updates - depend on configuration
        let progress = self.progress.clone();
        self.task_manager
            .task(
                "finish_progress",
                Scope::Manager,
                gettext("Finishing installation"),
            )
            .depends_on(&[config_task])
            .run(|| async move {
                progress
                    .call(progress::message::Finish::new(Scope::Manager))
                    .await
                    .map_err(TaskError::from_error)?;
                progress
                    .call(progress::message::SetStage::new(Stage::Finished))
                    .await
                    .map_err(TaskError::from_error)?;
                Ok(())
            })
            .await;

        tracing::info!("Installation tasks spawned");
        Ok(())
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
    pub access: Handler<agama_access::Service>,
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
        old_config: Config,
    ) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;

        // Security settings
        self.spawn_config_task(
            Scope::Security,
            &gettext("Storing security settings"),
            self.security.clone(),
            security::message::SetConfig::new(config.security.clone()),
            &[],
        )
        .await;

        // Remote access
        self.spawn_config_task(
            Scope::Access,
            &gettext("Configuring remote access"),
            self.access.clone(),
            agama_access::message::SetConfig::new(config.access.clone()),
            &[],
        )
        .await;

        // Hostname
        self.spawn_config_task(
            Scope::Hostname,
            &gettext("Setting up the hostname"),
            self.hostname.clone(),
            hostname::message::SetConfig::new(config.hostname.clone()),
            &[],
        )
        .await;

        // Proxy
        self.spawn_config_task(
            Scope::Proxy,
            &gettext("Setting up the network proxy"),
            self.proxy.clone(),
            proxy::message::SetConfig::new(config.proxy.clone()),
            &[],
        )
        .await;

        // NTP
        let ntp_task = self
            .spawn_config_task(
                Scope::Ntp,
                &gettext("Setting up NTP"),
                self.ntp.clone(),
                ntp::message::SetConfig::new(config.ntp.clone()),
                &[],
            )
            .await;

        // Files configuration
        let files_task = self
            .spawn_config_task(
                Scope::Files,
                &gettext("Importing user files and scripts"),
                self.files.clone(),
                files::message::SetConfig::new(config.files.clone()),
                &[],
            )
            .await;

        // Pre-installation scripts
        let files_handler = self.files.clone();
        self.task_manager
            .task(
                "pre_scripts",
                Scope::Files,
                gettext("Running user pre-installation scripts"),
            )
            .depends_on(&[files_task])
            .run(move || async move {
                files_handler
                    .call(files::message::RunScripts::new(ScriptsGroup::Pre))
                    .await
                    .map_err(TaskError::from_error)?;
                Ok(())
            })
            .await;

        // Questions settings
        self.spawn_config_task(
            Scope::Questions,
            &gettext("Storing questions settings"),
            self.questions.clone(),
            question::message::SetConfig::new(config.questions.clone()),
            &[],
        )
        .await;

        // L10n settings
        self.spawn_config_task(
            Scope::L10n,
            &gettext("Storing localization settings"),
            self.l10n.clone(),
            l10n::message::SetConfig::new(config.l10n.clone()),
            &[],
        )
        .await;

        // Users settings
        self.spawn_config_task(
            Scope::Users,
            &gettext("Storing users settings"),
            self.users.clone(),
            users::message::SetConfig::new(config.users.clone()),
            &[],
        )
        .await;

        let mut iscsi_deps = Vec::new();

        // Network configuration
        if let Some(task_id) = self.set_network_config(&config).await {
            iscsi_deps.push(task_id);
        }

        let mut storage_deps = Vec::new();

        // iSCSI configuration
        let iscsi_task = self.set_iscsi_config(&config, &iscsi_deps).await;
        storage_deps.push(iscsi_task);

        // S390 configuration (if available)
        if let Some(zfcp_task) = self.set_zfcp_config(&config).await {
            storage_deps.push(zfcp_task);
        }
        if let Some(dasd_task) = self.set_dasd_config(&config).await {
            storage_deps.push(dasd_task);
        }

        // Product-dependent configuration (software, storage, bootloader)
        if let Some(product) = product {
            // TODO: improve this check. In some cases, appying the very same config might imply a
            // change in the devices. For example, let say iSCSI config fails because a network
            // problem. A second attempt with the same config could success, so a probing would be
            // needed.
            let force_storage_probe =
                (config.iscsi != old_config.iscsi) || (config.s390 != old_config.s390);

            // Storage configuration
            let storage_task = self
                .set_storage_config(
                    Arc::clone(&product),
                    &config,
                    &storage_deps,
                    force_storage_probe,
                )
                .await;

            // Bootloader configuration (after storage)
            let bootloader_task = self.set_bootloader_config(&config, &[storage_task]).await;

            // Software configuration - depends on files, storage, and bootloader
            let software_task = self
                .set_software_config(
                    Arc::clone(&product),
                    &config,
                    &[files_task, storage_task, bootloader_task, ntp_task],
                )
                .await;

            // SELinux configuration - depends on software configuration
            self.set_selinux_config(software_task).await;
        }

        Ok(())
    }

    /// Helper to spawn a task for a config message call
    ///
    /// The task name is automatically derived from the scope by converting to lowercase.
    async fn spawn_config_task<S, M>(
        &self,
        scope: Scope,
        description: &str,
        handler: Handler<S>,
        message: M,
        dependencies: &[crate::task_manager::TaskId],
    ) -> crate::task_manager::TaskId
    where
        S: agama_utils::actor::MessageHandler<M> + 'static,
        M: agama_utils::actor::Message<Reply = ()> + Send + 'static,
        S::Error: std::error::Error + Send + 'static,
    {
        let name = format!("{}_config", scope.to_string().to_lowercase());

        self.task_manager
            .task(&name, scope, description)
            .depends_on(dependencies)
            .run(|| async move {
                handler.call(message).await.map_err(TaskError::from_error)?;
                Ok(())
            })
            .await
    }

    /// Helper to spawn iSCSI configuration task
    async fn set_iscsi_config(
        &self,
        config: &Config,
        dependencies: &[crate::task_manager::TaskId],
    ) -> task_manager::TaskId {
        let handler = self.iscsi.clone();
        let iscsi_config = config.iscsi.clone();
        self.task_manager
            .task(
                "iscsi_config",
                Scope::ISCSI,
                gettext("Configuring iSCSI devices"),
            )
            .depends_on(dependencies)
            .run(|| async move {
                let future = handler
                    .call(iscsi::message::SetConfig::new(iscsi_config))
                    .await
                    .map_err(TaskError::from_error)?;
                let _ = future.await;
                Ok(())
            })
            .await
    }

    /// Helper to spawn zFCP configuration task
    async fn set_zfcp_config(&self, config: &Config) -> Option<task_manager::TaskId> {
        let handler = self.s390.clone()?;
        let zfcp_config = config.s390.clone().and_then(|c| c.zfcp);

        Some(
            self.task_manager
                .task(
                    "zfcp_config",
                    Scope::ZFCP,
                    gettext("Configuring zFCP devices"),
                )
                .run(|| async move {
                    let future = handler
                        .call(s390::message::SetZFCPConfig::new(zfcp_config))
                        .await
                        .map_err(TaskError::from_error)?;
                    let _ = future.await;
                    Ok(())
                })
                .await,
        )
    }

    /// Helper to spawn DASD configuration task
    async fn set_dasd_config(&self, config: &Config) -> Option<crate::task_manager::TaskId> {
        let handler = self.s390.clone()?;
        let dasd_config = config.s390.clone().and_then(|c| c.dasd);

        Some(
            self.task_manager
                .task(
                    "dasd_config",
                    Scope::DASD,
                    gettext("Configuring DASD devices"),
                )
                .run(|| async move {
                    let future = handler
                        .call(s390::message::SetDASDConfig::new(dasd_config))
                        .await
                        .map_err(TaskError::from_error)?;
                    let _ = future.await;
                    Ok(())
                })
                .await,
        )
    }

    /// Helper to spawn network configuration task
    async fn set_network_config(&self, config: &Config) -> Option<crate::task_manager::TaskId> {
        let network_config = config.network.clone()?;
        let handler = self.network.clone();

        Some(
            self.task_manager
                .task(
                    "network_config",
                    Scope::Network,
                    gettext("Setting up the network"),
                )
                .run(|| async move {
                    handler
                        .update_config(network_config)
                        .await
                        .map_err(TaskError::from_error)?;
                    handler.apply().await.map_err(TaskError::from_error)?;
                    Ok(())
                })
                .await,
        )
    }

    /// Helper to spawn storage configuration task
    async fn set_storage_config(
        &self,
        product: Arc<RwLock<ProductSpec>>,
        config: &Config,
        dependencies: &[crate::task_manager::TaskId],
        force_probe: bool,
    ) -> crate::task_manager::TaskId {
        let handler = self.storage.clone();
        let storage_config = config.storage.clone();

        self.task_manager
            .task(
                "storage_config",
                Scope::Storage,
                gettext("Preparing the storage proposal"),
            )
            .depends_on(dependencies)
            .run(move || async move {
                if force_probe {
                    tracing::info!("Forcing a storage probing");
                    handler
                        .call(storage::message::Probe)
                        .await
                        .map_err(TaskError::from_error)?;
                }
                let future = handler
                    .call(storage::message::SetConfig::new(product, storage_config))
                    .await
                    .map_err(TaskError::from_error)?;
                let _ = future.await;
                Ok(())
            })
            .await
    }

    /// Helper to spawn bootloader configuration task
    async fn set_bootloader_config(
        &self,
        config: &Config,
        dependencies: &[crate::task_manager::TaskId],
    ) -> task_manager::TaskId {
        let handler = self.bootloader.clone();
        let bootloader_config = config.bootloader.clone();
        self.task_manager
            .task(
                "bootloader_config",
                Scope::Bootloader,
                gettext("Storing bootloader settings"),
            )
            .depends_on(dependencies)
            .run(|| async move {
                let future = handler
                    .call(bootloader::message::SetConfig::new(bootloader_config))
                    .await
                    .map_err(TaskError::from_error)?;
                let _ = future.await;
                Ok(())
            })
            .await
    }

    /// Helper to spawn software configuration task
    async fn set_software_config(
        &self,
        product: Arc<RwLock<ProductSpec>>,
        config: &Config,
        dependencies: &[crate::task_manager::TaskId],
    ) -> crate::task_manager::TaskId {
        let software_handler = self.software.clone();
        let software_config = config.software.clone();
        let access_handler = self.access.clone();
        let bootloader_handler = self.bootloader.clone();
        let files_handler = self.files.clone();
        let ntp_handler = self.ntp.clone();
        let storage_handler = self.storage.clone();

        self.task_manager
            .task(
                "software_config",
                Scope::Software,
                gettext("Preparing the software proposal"),
            )
            .depends_on(dependencies)
            .run(move || async move {
                Self::set_resolvables_for(&software_handler, "access", access_handler).await;
                Self::set_resolvables_for(&software_handler, "files", files_handler).await;
                Self::set_resolvables_for(&software_handler, "ntp", ntp_handler).await;
                Self::set_resolvables_for(&software_handler, "storage", storage_handler).await;
                Self::set_resolvables_for(&software_handler, "bootloader", bootloader_handler)
                    .await;

                software_handler
                    .call(software::message::SetConfig::new(product, software_config))
                    .await
                    .map_err(TaskError::from_error)?;

                Ok(())
            })
            .await
    }

    /// Helper to spawn SELinux configuration task
    async fn set_selinux_config(
        &self,
        depends_on: crate::task_manager::TaskId,
    ) -> crate::task_manager::TaskId {
        let software_handler = self.software.clone();
        let bootloader_handler = self.bootloader.clone();

        self.task_manager
            .task(
                "selinux_config",
                Scope::Security,
                gettext("Configuring SELinux"),
            )
            .depends_on(&[depends_on])
            .run(move || async move {
                let selinux_selected = software_handler
                    .call(software::message::IsPatternSelected::new(
                        "selinux".to_string(),
                    ))
                    .await
                    .map_err(TaskError::from_error)?;

                let value = if selinux_selected {
                    "security=selinux"
                } else {
                    "security="
                };
                let message = agama_bootloader::message::SetKernelArg {
                    id: "selinux".to_string(),
                    value: value.to_string(),
                };

                bootloader_handler
                    .call(message)
                    .await
                    .map_err(TaskError::from_error)?;

                Ok(())
            })
            .await
    }

    async fn set_resolvables_for<T>(
        software: &Handler<software::Service>,
        id: &str,
        handler: Handler<T>,
    ) where
        T: MessageHandler<GetResolvables>,
    {
        let resolvables = handler.call(GetResolvables).await.unwrap_or_default();
        let result = software
            .call(software::message::SetResolvables::new(
                id.to_string(),
                resolvables,
            ))
            .await;
        if let Err(error) = result {
            tracing::error!("Failed to set resolvables for '{id}': {error}");
        }
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
