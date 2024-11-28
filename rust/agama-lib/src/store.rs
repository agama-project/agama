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

//! Load/store the settings from/to the D-Bus services.
// TODO: quickly explain difference between FooSettings and FooStore, with an example

use crate::base_http_client::BaseHTTPClient;
use crate::error::ServiceError;
use crate::install_settings::InstallSettings;
use crate::manager::{InstallationPhase, ManagerHTTPClient};
use crate::scripts::{ScriptsClient, ScriptsGroup};
use crate::{
    localization::LocalizationStore, network::NetworkStore, product::ProductStore,
    scripts::ScriptsStore, software::SoftwareStore, storage::StorageStore, users::UsersStore,
};

/// Struct that loads/stores the settings from/to the D-Bus services.
///
/// It is composed by a set of "stores" that are able to load/store the
/// settings for each service.
///
/// This struct uses the default connection built by [connection function](super::connection).
pub struct Store {
    users: UsersStore,
    network: NetworkStore,
    product: ProductStore,
    software: SoftwareStore,
    storage: StorageStore,
    localization: LocalizationStore,
    scripts: ScriptsStore,
    manager_client: ManagerHTTPClient,
    http_client: BaseHTTPClient,
}

impl Store {
    pub async fn new(http_client: BaseHTTPClient) -> Result<Store, ServiceError> {
        Ok(Self {
            localization: LocalizationStore::new(http_client.clone())?,
            users: UsersStore::new(http_client.clone())?,
            network: NetworkStore::new(http_client.clone()).await?,
            product: ProductStore::new(http_client.clone())?,
            software: SoftwareStore::new(http_client.clone())?,
            storage: StorageStore::new(http_client.clone())?,
            scripts: ScriptsStore::new(http_client.clone()),
            manager_client: ManagerHTTPClient::new(http_client.clone()),
            http_client,
        })
    }

    /// Loads the installation settings from the HTTP interface.
    pub async fn load(&self) -> Result<InstallSettings, ServiceError> {
        let mut settings = InstallSettings {
            network: Some(self.network.load().await?),
            software: Some(self.software.load().await?),
            user: Some(self.users.load().await?),
            product: Some(self.product.load().await?),
            localization: Some(self.localization.load().await?),
            scripts: Some(self.scripts.load().await?),
            ..Default::default()
        };

        let storage_settings = self.storage.load().await?;
        settings.storage = storage_settings.storage;
        settings.storage_autoyast = storage_settings.storage_autoyast;

        // TODO: use try_join here
        Ok(settings)
    }

    /// Stores the given installation settings in the D-Bus service
    ///
    /// As part of the process it runs pre-scripts and forces a probe if the installation phase is
    /// "config". It causes the storage proposal to be reset. This behavior should be revisited in
    /// the future but it might be the storage service the responsible for dealing with this.
    ///
    /// * `settings`: installation settings.
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), ServiceError> {
        if let Some(scripts) = &settings.scripts {
            self.scripts.store(scripts).await?;

            if scripts.pre.as_ref().is_some_and(|s| !s.is_empty()) {
                self.run_pre_scripts().await?;
            }
        }

        if let Some(network) = &settings.network {
            self.network.store(network).await?;
        }
        // order is important here as network can be critical for connection
        // to registration server and selecting product is important for rest
        if let Some(product) = &settings.product {
            self.product.store(product).await?;
        }
        // ordering: localization after product as some product may miss some locales
        if let Some(localization) = &settings.localization {
            self.localization.store(localization).await?;
        }
        if let Some(software) = &settings.software {
            self.software.store(software).await?;
        }
        if let Some(user) = &settings.user {
            self.users.store(user).await?;
        }
        if settings.storage.is_some() || settings.storage_autoyast.is_some() {
            self.storage.store(&settings.into()).await?
        }

        Ok(())
    }

    /// Runs the pre-installation scripts and forces a probe if the installation phase is "config".
    async fn run_pre_scripts(&self) -> Result<(), ServiceError> {
        let scripts_client = ScriptsClient::new(self.http_client.clone());
        scripts_client.run_scripts(ScriptsGroup::Pre).await?;

        let status = self.manager_client.status().await;
        if status.is_ok_and(|s| s.phase == InstallationPhase::Config) {
            self.manager_client.probe().await?;
        }
        Ok(())
    }
}
