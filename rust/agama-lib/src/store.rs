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
    bootloader::store::{BootloaderStore, BootloaderStoreError},
    hostname::store::{HostnameStore, HostnameStoreError},
    http::BaseHTTPClient,
    install_settings::InstallSettings,
    manager::{http_client::ManagerHTTPClientError, InstallationPhase, ManagerHTTPClient},
    network::{NetworkStore, NetworkStoreError},
    scripts::{ScriptsClient, ScriptsClientError, ScriptsGroup, ScriptsStore, ScriptsStoreError},
    security::store::{SecurityStore, SecurityStoreError},
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
    users::{UsersStore, UsersStoreError},
};

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error(transparent)]
    Bootloader(#[from] BootloaderStoreError),
    #[error(transparent)]
    DASD(#[from] DASDStoreError),
    #[error(transparent)]
    Hostname(#[from] HostnameStoreError),
    #[error(transparent)]
    Users(#[from] UsersStoreError),
    #[error(transparent)]
    Network(#[from] NetworkStoreError),
    #[error(transparent)]
    Security(#[from] SecurityStoreError),
    #[error(transparent)]
    Storage(#[from] StorageStoreError),
    #[error(transparent)]
    ISCSI(#[from] ISCSIHTTPClientError),
    #[error(transparent)]
    Scripts(#[from] ScriptsStoreError),
    // FIXME: it uses the client instead of the store.
    #[error(transparent)]
    ScriptsClient(#[from] ScriptsClientError),
    #[error(transparent)]
    Manager(#[from] ManagerHTTPClientError),
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
    bootloader: BootloaderStore,
    dasd: DASDStore,
    hostname: HostnameStore,
    users: UsersStore,
    network: NetworkStore,
    security: SecurityStore,
    storage: StorageStore,
    scripts: ScriptsStore,
    iscsi_client: ISCSIHTTPClient,
    manager_client: ManagerHTTPClient,
    http_client: BaseHTTPClient,
    zfcp: ZFCPStore,
}

impl Store {
    pub async fn new(http_client: BaseHTTPClient) -> Result<Store, StoreError> {
        Ok(Self {
            bootloader: BootloaderStore::new(http_client.clone()),
            dasd: DASDStore::new(http_client.clone()),
            hostname: HostnameStore::new(http_client.clone()),
            users: UsersStore::new(http_client.clone()),
            network: NetworkStore::new(http_client.clone()),
            security: SecurityStore::new(http_client.clone()),
            storage: StorageStore::new(http_client.clone()),
            scripts: ScriptsStore::new(http_client.clone()),
            manager_client: ManagerHTTPClient::new(http_client.clone()),
            iscsi_client: ISCSIHTTPClient::new(http_client.clone()),
            zfcp: ZFCPStore::new(http_client.clone()),
            http_client,
        })
    }

    /// Loads the installation settings from the HTTP interface.
    pub async fn load(&self) -> Result<InstallSettings, StoreError> {
        let mut settings = InstallSettings {
            bootloader: self.bootloader.load().await?,
            dasd: self.dasd.load().await?,
            hostname: Some(self.hostname.load().await?),
            network: Some(self.network.load().await?),
            security: self.security.load().await?.to_option(),
            user: Some(self.users.load().await?),
            scripts: self.scripts.load().await?.to_option(),
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
    /// As part of the process it runs pre-scripts and forces a probe if the installation phase is
    /// "config". It causes the storage proposal to be reset. This behavior should be revisited in
    /// the future but it might be the storage service the responsible for dealing with this.
    ///
    /// * `settings`: installation settings.
    pub async fn store(&self, settings: &InstallSettings) -> Result<(), StoreError> {
        if let Some(scripts) = &settings.scripts {
            self.scripts.store(scripts).await?;

            if scripts.pre.as_ref().is_some_and(|s| !s.is_empty()) {
                self.run_pre_scripts().await?;
            }
        }

        if let Some(network) = &settings.network {
            self.network.store(network).await?;
        }
        // security has to be done before product to allow registration against
        // self-signed RMT
        if let Some(security) = &settings.security {
            self.security.store(security).await?;
        }
        if let Some(user) = &settings.user {
            self.users.store(user).await?;
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
        if let Some(bootloader) = &settings.bootloader {
            self.bootloader.store(bootloader).await?;
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

    /// Runs the pre-installation scripts and forces a probe if the installation phase is "config".
    async fn run_pre_scripts(&self) -> Result<(), StoreError> {
        let scripts_client = ScriptsClient::new(self.http_client.clone());
        scripts_client.run_scripts(ScriptsGroup::Pre).await?;

        let status = self.manager_client.status().await;
        if status.is_ok_and(|s| s.phase == InstallationPhase::Config) {
            self.manager_client.probe().await?;
        }
        Ok(())
    }
}
