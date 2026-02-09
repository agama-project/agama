// Copyright (c) [2026] SUSE LLC
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

use std::sync::Arc;

use crate::{
    bootloader, files, hostname, iscsi, l10n, proxy, security, service, software, storage,
    tasks::message, users,
};
use agama_network::NetworkSystemClient;
use agama_utils::{
    actor::{Actor, Handler, MessageHandler},
    api::{files::scripts::ScriptsGroup, status::Stage, Config, Scope},
    products::ProductSpec,
    progress, question,
};
use async_trait::async_trait;
use gettextrs::gettext;
use tokio::sync::RwLock;

/// Runs long tasks in background.
///
/// This struct takes care of running the logic to set the configuration (Task::SetConfig]) and to
/// install the system (Task::Install) in background. Additionally, it makes sure that only one of
/// those tasks run at the same time and in the same order they are received by using a mpsc
/// channel.
pub struct TasksRunner {
    pub bootloader: Handler<bootloader::Service>,
    pub files: Handler<files::Service>,
    pub hostname: Handler<hostname::Service>,
    pub iscsi: Handler<iscsi::Service>,
    pub l10n: Handler<l10n::Service>,
    pub network: NetworkSystemClient,
    pub progress: Handler<progress::Service>,
    pub proxy: Handler<proxy::Service>,
    pub questions: Handler<question::Service>,
    pub security: Handler<security::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub users: Handler<users::Service>,
}

impl Actor for TasksRunner {
    type Error = service::Error;
}

#[async_trait]
impl MessageHandler<message::Install> for TasksRunner {
    /// It returns the status of the installation.
    async fn handle(&mut self, _message: message::Install) -> Result<(), service::Error> {
        let action = InstallAction {
            hostname: self.hostname.clone(),
            l10n: self.l10n.clone(),
            network: self.network.clone(),
            proxy: self.proxy.clone(),
            software: self.software.clone(),
            storage: self.storage.clone(),
            files: self.files.clone(),
            progress: self.progress.clone(),
            users: self.users.clone(),
        };
        action.run().await;
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for TasksRunner {
    /// It returns the status of the installation.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), service::Error> {
        let action = SetConfigAction {
            bootloader: self.bootloader.clone(),
            files: self.files.clone(),
            hostname: self.hostname.clone(),
            iscsi: self.iscsi.clone(),
            l10n: self.l10n.clone(),
            network: self.network.clone(),
            proxy: self.proxy.clone(),
            questions: self.questions.clone(),
            security: self.security.clone(),
            software: self.software.clone(),
            storage: self.storage.clone(),
            users: self.users.clone(),
        };

        if let Err(error) = action.run(message.product, message.config).await {
            tracing::error!("Failed to set the configuration: {error}");
        }
        Ok(())
    }
}

/// Implements the installation process.
///
/// This action runs on a separate Tokio task to prevent the manager from blocking.
struct InstallAction {
    hostname: Handler<hostname::Service>,
    l10n: Handler<l10n::Service>,
    network: NetworkSystemClient,
    proxy: Handler<proxy::Service>,
    software: Handler<software::Service>,
    storage: Handler<storage::Service>,
    files: Handler<files::Service>,
    progress: Handler<progress::Service>,
    users: Handler<users::Service>,
}

impl InstallAction {
    /// Runs the installation process on a separate Tokio task.
    pub async fn run(mut self) {
        tracing::info!("Installation started");
        if let Err(error) = self.install().await {
            tracing::error!("Installation failed: {error}");
            if let Err(error) = self
                .progress
                .call(progress::message::SetStage::new(Stage::Failed))
                .await
            {
                tracing::error!(
                    "It was not possible to set the stage to {}: {error}",
                    Stage::Failed
                );
            }
        } else {
            tracing::info!("Installation finished");
        }
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

        // call files before storage finish as it unmount /mnt/run which is important for chrooted scripts
        self.files
            .call(files::message::RunScripts::new(ScriptsGroup::Post))
            .await?;
        self.storage.call(storage::message::Finish).await?;

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
}

/// Implements the set config logic.
///
/// This action runs on a separate Tokio task to prevent the manager from blocking.
struct SetConfigAction {
    bootloader: Handler<bootloader::Service>,
    files: Handler<files::Service>,
    hostname: Handler<hostname::Service>,
    iscsi: Handler<iscsi::Service>,
    l10n: Handler<l10n::Service>,
    network: NetworkSystemClient,
    proxy: Handler<proxy::Service>,
    questions: Handler<question::Service>,
    security: Handler<security::Service>,
    software: Handler<software::Service>,
    storage: Handler<storage::Service>,
    users: Handler<users::Service>,
}

impl SetConfigAction {
    pub async fn run(
        self,
        product: Option<Arc<RwLock<ProductSpec>>>,
        config: Config,
    ) -> Result<(), service::Error> {
        self.security
            .call(security::message::SetConfig::new(config.security.clone()))
            .await?;

        self.hostname
            .call(hostname::message::SetConfig::new(config.hostname.clone()))
            .await?;

        self.proxy
            .call(proxy::message::SetConfig::new(config.proxy.clone()))
            .await?;

        self.files
            .call(files::message::SetConfig::new(config.files.clone()))
            .await?;

        self.files
            .call(files::message::RunScripts::new(ScriptsGroup::Pre))
            .await?;

        self.questions
            .call(question::message::SetConfig::new(config.questions.clone()))
            .await?;

        self.l10n
            .call(l10n::message::SetConfig::new(config.l10n.clone()))
            .await?;

        self.users
            .call(users::message::SetConfig::new(config.users.clone()))
            .await?;

        self.iscsi
            .call(iscsi::message::SetConfig::new(config.iscsi.clone()))
            .await?;

        if let Some(network) = config.network.clone() {
            self.network.update_config(network).await?;
            self.network.apply().await?;
        }

        match &product {
            Some(product) => {
                self.software
                    .call(software::message::SetConfig::new(
                        Arc::clone(product),
                        config.software.clone(),
                    ))
                    .await?;

                self.storage
                    .call(storage::message::SetConfig::new(
                        Arc::clone(product),
                        config.storage.clone(),
                    ))
                    .await?;

                // call bootloader always after storage to ensure that bootloader reflect new storage settings
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
