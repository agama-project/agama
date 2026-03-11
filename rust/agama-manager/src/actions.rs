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

use std::{process::Command, str::FromStr, sync::Arc};

use agama_network::NetworkSystemClient;
use agama_utils::{
    actor::Handler,
    api::{files::scripts::ScriptsGroup, status::Stage, Config, FinishMethod, Scope},
    issue,
    kernel_cmdline::KernelCmdline,
    products::ProductSpec,
    progress, question,
};
use gettextrs::gettext;
use tokio::sync::RwLock;

use crate::{
    bootloader, checks, files, hostname, iscsi, l10n, proxy, s390, security, service, software,
    storage, users,
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
        self.files.call(files::message::WriteFiles).await?;
        self.network.install().await?;
        self.proxy.call(proxy::message::Finish).await?;
        self.hostname.call(hostname::message::Install).await?;
        self.users.call(users::message::Install).await?;
        self.storage.call(storage::message::Finish).await?;

        // call files before storage finish as it unmount /mnt/run which is important for chrooted scripts
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
    pub progress: Handler<progress::Service>,
    pub questions: Handler<question::Service>,
    pub security: Handler<security::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub users: Handler<users::Service>,
    pub s390: Option<Handler<s390::Service>>,
}

impl SetConfigAction {
    pub async fn run(
        self,
        product: Option<Arc<RwLock<ProductSpec>>>,
        config: Config,
    ) -> Result<(), service::Error> {
        checks::check_stage(&self.progress, Stage::Configuring).await?;

        //
        // Preparation
        //
        let mut steps = vec![
            gettext("Storing security settings"),
            gettext("Setting up the hostname"),
            gettext("Setting up the network proxy"),
            gettext("Importing user files"),
            gettext("Running user pre-installation scripts"),
            gettext("Storing questions settings"),
            gettext("Storing localization settings"),
            gettext("Storing users settings"),
            gettext("Configuring iSCSI devices"),
        ];

        if self.s390.is_some() {
            steps.push(gettext("Configuring DASD devices"));
        }

        if config.network.is_some() {
            steps.push(gettext("Setting up the network"));
        }

        if product.is_some() {
            steps.extend_from_slice(&[
                gettext("Preparing the software proposal"),
                gettext("Preparing the storage proposal"),
                gettext("Storing bootloader settings"),
            ])
        }

        self.progress
            .call(progress::message::StartWithSteps::new(
                Scope::Manager,
                steps,
            ))
            .await?;

        //
        // Set the configuration for each service
        //
        self.security
            .call(security::message::SetConfig::new(config.security.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.hostname
            .call(hostname::message::SetConfig::new(config.hostname.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.proxy
            .call(proxy::message::SetConfig::new(config.proxy.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.files
            .call(files::message::SetConfig::new(config.files.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.files
            .call(files::message::RunScripts::new(ScriptsGroup::Pre))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.questions
            .call(question::message::SetConfig::new(config.questions.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.l10n
            .call(l10n::message::SetConfig::new(config.l10n.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.users
            .call(users::message::SetConfig::new(config.users.clone()))
            .await?;

        self.progress
            .call(progress::message::Next::new(Scope::Manager))
            .await?;
        self.iscsi
            .call(iscsi::message::SetConfig::new(config.iscsi.clone()))
            .await?;

        if let Some(s390) = &self.s390 {
            self.progress
                .call(progress::message::Next::new(Scope::Manager))
                .await?;
            s390.call(s390::message::SetConfig::new(config.s390.clone()))
                .await?;
        }

        if let Some(network) = config.network.clone() {
            self.progress
                .call(progress::message::Next::new(Scope::Manager))
                .await?;
            self.network.update_config(network).await?;
            self.network.apply().await?;
        }

        match &product {
            Some(product) => {
                self.progress
                    .call(progress::message::Next::new(Scope::Manager))
                    .await?;
                self.software
                    .call(software::message::SetConfig::new(
                        Arc::clone(product),
                        config.software.clone(),
                    ))
                    .await?;

                self.progress
                    .call(progress::message::Next::new(Scope::Manager))
                    .await?;
                let future = self
                    .storage
                    .call(storage::message::SetConfig::new(
                        Arc::clone(product),
                        config.storage.clone(),
                    ))
                    .await?;
                let _ = future.await;

                // call bootloader always after storage to ensure that bootloader reflect new storage settings
                self.progress
                    .call(progress::message::Next::new(Scope::Manager))
                    .await?;
                self.bootloader
                    .call(bootloader::message::SetConfig::new(
                        config.bootloader.clone(),
                    ))
                    .await?;
            }

            None => {
                // TODO: reset software and storage proposals.
                tracing::info!("No product is selected.");
            }
        }

        Ok(())
    }
}

/// Implements the finish action.
pub struct FinishAction {
    method: Option<FinishMethod>,
}

impl FinishAction {
    pub fn new(method: Option<FinishMethod>) -> Self {
        Self { method }
    }

    pub fn run(self) {
        let method = self.method.unwrap_or_else(|| {
            let inst_finish_method = KernelCmdline::parse()
                .ok()
                .and_then(|a| a.get_last("inst.finish"))
                .and_then(|m| FinishMethod::from_str(&m).ok());
            inst_finish_method.unwrap_or_default()
        });

        tracing::info!("Finishing the installation process ({})", method);

        let option = match method {
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
