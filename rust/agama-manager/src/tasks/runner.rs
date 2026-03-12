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

use std::str::FromStr;

use crate::{
    actions::{FinishAction, InstallAction, SetConfigAction},
    bootloader, files, hostname, iscsi, l10n, proxy, s390, security, service, software, storage,
    tasks::message,
    users,
};
use agama_network::NetworkSystemClient;
use agama_utils::{
    actor::{Actor, Handler, MessageHandler},
    api::{FinishMethod, Scope},
    issue,
    kernel_cmdline::KernelCmdline,
    progress, question,
};
use async_trait::async_trait;

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
    pub issues: Handler<issue::Service>,
    pub l10n: Handler<l10n::Service>,
    pub network: NetworkSystemClient,
    pub progress: Handler<progress::Service>,
    pub proxy: Handler<proxy::Service>,
    pub questions: Handler<question::Service>,
    pub security: Handler<security::Service>,
    pub software: Handler<software::Service>,
    pub storage: Handler<storage::Service>,
    pub users: Handler<users::Service>,
    pub s390: Option<Handler<s390::Service>>,
}

impl Actor for TasksRunner {
    type Error = service::Error;
}

#[async_trait]
impl MessageHandler<message::Install> for TasksRunner {
    /// It starts the installation process.
    async fn handle(&mut self, _message: message::Install) -> Result<(), service::Error> {
        let action = InstallAction {
            issues: self.issues.clone(),
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

        tracing::info!("Installation started");
        action
            .run()
            .await
            .inspect_err(|e| tracing::error!("Installation failed: {e}"))?;

        //
        // Make sure to finish the progress
        //
        _ = self
            .progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await;
        tracing::info!("Installation finished");

        //
        // Finish the installer (using the default option).
        //
        let method = FinishMethod::from_kernel_cmdline().unwrap_or(FinishMethod::Stop);
        let finish = FinishAction::new(method);
        finish.run();
        Ok(())
    }
}

#[async_trait]
impl MessageHandler<message::SetConfig> for TasksRunner {
    /// It sets the configuration.
    async fn handle(&mut self, message: message::SetConfig) -> Result<(), service::Error> {
        let action = SetConfigAction {
            bootloader: self.bootloader.clone(),
            files: self.files.clone(),
            hostname: self.hostname.clone(),
            iscsi: self.iscsi.clone(),
            l10n: self.l10n.clone(),
            network: self.network.clone(),
            progress: self.progress.clone(),
            proxy: self.proxy.clone(),
            questions: self.questions.clone(),
            security: self.security.clone(),
            software: self.software.clone(),
            storage: self.storage.clone(),
            users: self.users.clone(),
            s390: self.s390.clone(),
        };

        if let Err(error) = action.run(message.product, message.config).await {
            tracing::error!("Failed to set the configuration: {error}");
        }

        //
        // Make sure to finish the progress
        //
        _ = self
            .progress
            .call(progress::message::Finish::new(Scope::Manager))
            .await;
        Ok(())
    }
}
