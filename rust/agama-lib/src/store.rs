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

use crate::{
    hostname::store::{HostnameStore, HostnameStoreError},
    http::BaseHTTPClient,
    install_settings::InstallSettings,
    network::{NetworkStore, NetworkStoreError},
    storage::{
        http_client::{
            iscsi::{ISCSIHTTPClient, ISCSIHTTPClientError},
            StorageHTTPClient,
        },
        store::{
            dasd::{DASDStore, DASDStoreError},
            zfcp::{ZFCPStore, ZFCPStoreError},
        },
        StorageStore, StorageStoreError,
    },
};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error(transparent)]
    DASD(#[from] DASDStoreError),
    #[error(transparent)]
    Hostname(#[from] HostnameStoreError),
    #[error(transparent)]
    Network(#[from] NetworkStoreError),
    #[error(transparent)]
    Storage(#[from] StorageStoreError),
    #[error(transparent)]
    ISCSI(#[from] ISCSIHTTPClientError),
    #[error(transparent)]
    ZFCP(#[from] ZFCPStoreError),
    #[error("Could not calculate the context")]
    InvalidStoreContext,
}

/// Struct that loads/stores the settings from/to the D-Bus services.
///
/// It is composed by a set of "stores" that are able to load/store the
/// settings for each service.
///
/// This struct uses the default connection built by [connection function](super::connection).
pub struct Store {
    dasd: DASDStore,
    hostname: HostnameStore,
    network: NetworkStore,
    storage: StorageStore,
    iscsi_client: ISCSIHTTPClient,
    http_client: BaseHTTPClient,
    zfcp: ZFCPStore,
}

impl Store {
    pub async fn new(http_client: BaseHTTPClient) -> Result<Store, StoreError> {
        Ok(Self {
            dasd: DASDStore::new(http_client.clone()),
            hostname: HostnameStore::new(http_client.clone()),
            network: NetworkStore::new(http_client.clone()),
            storage: StorageStore::new(http_client.clone()),
            iscsi_client: ISCSIHTTPClient::new(http_client.clone()),
            zfcp: ZFCPStore::new(http_client.clone()),
            http_client,
        })
    }

    /// Loads the installation settings from the HTTP interface.
    pub async fn load(&self) -> Result<InstallSettings, StoreError> {
        let mut settings = InstallSettings {
            dasd: self.dasd.load().await?,
            hostname: Some(self.hostname.load().await?),
            network: Some(self.network.load().await?),
            zfcp: self.zfcp.load().await?,
            ..Default::default()
        };

        if let Some(storage_settings) = self.storage.load().await? {
            settings.storage = storage_settings.storage;
            settings.storage_autoyast = storage_settings.storage_autoyast;
        }

        // TODO: use try_join here
        Ok(settings)
    }

    /// Stores the given installation settings in the Agama service
    ///
    /// It causes the storage proposal to be reset. This behavior should be revisited in
    /// the future but it might be the storage service the responsible for dealing with this.
    ///
    /// * `settings`: installation settings.
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), StoreError> {
        if let Some(network) = &settings.network {
            self.network.store(network).await?;
        }
        let mut dirty_flag_set = false;
        // iscsi has to be done before storage
        if let Some(iscsi) = &settings.iscsi {
            self.iscsi_client.set_config(iscsi).await?
        }
        // dasd devices has to be activated before storage
        if let Some(dasd) = &settings.dasd {
            dirty_flag_set = true;
            self.dasd.store(dasd).await?
        }
        // zfcp devices has to be activated before storage
        if let Some(zfcp) = &settings.zfcp {
            dirty_flag_set = true;
            self.zfcp.store(zfcp).await?
        }
        // Reprobing storage is not directly done by zFCP, DASD or iSCSI services for a matter of
        // efficiency. For now, clients are expected to explicitly reprobe. It is important to
        // reprobe here before loading the storage settings. Otherwise, the new storage devices are
        // not used.
        if dirty_flag_set {
            self.reprobe_storage().await?;
        }

        if settings.storage.is_some() || settings.storage_autoyast.is_some() {
            self.storage.store(&settings.into()).await?
        }
        if let Some(hostname) = &settings.hostname {
            self.hostname.store(hostname).await?;
        }

        Ok(())
    }

    // Reprobes the storage devices if the system was marked as deprecated.
    async fn reprobe_storage(&self) -> Result<(), StorageStoreError> {
        let storage_client = StorageHTTPClient::new(self.http_client.clone());
        if storage_client.is_dirty().await? {
            storage_client.reprobe().await?;
        }
        Ok(())
    }
}
