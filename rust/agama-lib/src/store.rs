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
use crate::{
    localization::LocalizationStore, network::NetworkStore, product::ProductStore,
    software::SoftwareStore, storage::StorageStore, users::UsersStore,
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
}

impl<'a> Store<'a> {
    pub async fn new(
        connection: Connection,
        http_client: BaseHTTPClient
    ) -> Result<Store<'a>, ServiceError> {
        Ok(Self {
            localization: LocalizationStore::new()?,
            users: UsersStore::new()?,
            network: NetworkStore::new(http_client).await?,
            product: ProductStore::new()?,
            software: SoftwareStore::new()?,
            storage: StorageStore::new()?,
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
            ..Default::default()
        };

        let storage_settings = self.storage.load().await?;
        settings.storage = storage_settings.storage;
        settings.storage_autoyast = storage_settings.storage_autoyast;

        // TODO: use try_join here
        Ok(settings)
    }

    /// Stores the given installation settings in the D-Bus service
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), ServiceError> {
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
}
