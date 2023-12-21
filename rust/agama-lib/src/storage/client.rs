//! Implements a client to access Agama's storage service.

use super::proxies::{BlockDeviceProxy, ProposalCalculatorProxy, ProposalProxy, Storage1Proxy};
use super::StorageSettings;
use crate::error::ServiceError;
use futures_util::future::join_all;
use serde::Serialize;
use std::collections::HashMap;
use zbus::zvariant::OwnedObjectPath;
use zbus::Connection;

/// Represents a storage device
#[derive(Serialize, Debug)]
pub struct StorageDevice {
    name: String,
    description: String,
}

/// D-Bus client for the storage service
pub struct StorageClient<'a> {
    pub connection: Connection,
    calculator_proxy: ProposalCalculatorProxy<'a>,
    storage_proxy: Storage1Proxy<'a>,
}

impl<'a> StorageClient<'a> {
    pub async fn new(connection: Connection) -> Result<StorageClient<'a>, ServiceError> {
        Ok(Self {
            calculator_proxy: ProposalCalculatorProxy::new(&connection).await?,
            storage_proxy: Storage1Proxy::new(&connection).await?,
            connection,
        })
    }

    /// Returns the proposal proxy
    ///
    /// The proposal might not exist.
    // NOTE: should we implement some kind of memoization?
    async fn proposal_proxy(&self) -> Result<ProposalProxy<'a>, ServiceError> {
        Ok(ProposalProxy::new(&self.connection).await?)
    }

    /// Returns the available devices
    ///
    /// These devices can be used for installing the system.
    pub async fn available_devices(&self) -> Result<Vec<StorageDevice>, ServiceError> {
        let devices: Vec<_> = self
            .calculator_proxy
            .available_devices()
            .await?
            .into_iter()
            .map(|path| self.storage_device(path))
            .collect();

        join_all(devices).await.into_iter().collect()
    }

    /// Returns the storage device for the given D-Bus path
    async fn storage_device(
        &self,
        dbus_path: OwnedObjectPath,
    ) -> Result<StorageDevice, ServiceError> {
        let proxy = BlockDeviceProxy::builder(&self.connection)
            .path(dbus_path)?
            .build()
            .await?;

        let name = proxy.name().await?;
        // TODO: The description is not used yet. Decide what info to show, for example the device
        // size, see https://crates.io/crates/size.
        let description = name.clone();

        Ok(StorageDevice { name, description })
    }

    /// Returns the boot device proposal setting
    pub async fn boot_device(&self) -> Result<Option<String>, ServiceError> {
        let proxy = self.proposal_proxy().await?;
        let value = self.proposal_value(proxy.boot_device().await)?;

        match value {
            Some(v) if v.is_empty() => Ok(None),
            Some(v) => Ok(Some(v)),
            None => Ok(None),
        }
    }

    /// Returns the lvm proposal setting
    pub async fn lvm(&self) -> Result<Option<bool>, ServiceError> {
        let proxy = self.proposal_proxy().await?;
        self.proposal_value(proxy.lvm().await)
    }

    /// Returns the encryption password proposal setting
    pub async fn encryption_password(&self) -> Result<Option<String>, ServiceError> {
        let proxy = self.proposal_proxy().await?;
        let value = self.proposal_value(proxy.encryption_password().await)?;

        match value {
            Some(v) if v.is_empty() => Ok(None),
            Some(v) => Ok(Some(v)),
            None => Ok(None),
        }
    }

    fn proposal_value<T>(&self, value: Result<T, zbus::Error>) -> Result<Option<T>, ServiceError> {
        match value {
            Ok(v) => Ok(Some(v)),
            Err(zbus::Error::MethodError(name, _, _))
                if name.as_str() == "org.freedesktop.DBus.Error.UnknownObject" =>
            {
                Ok(None)
            }
            Err(e) => Err(e.into()),
        }
    }

    /// Runs the probing process
    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.storage_proxy.probe().await?)
    }

    pub async fn calculate(&self, settings: &StorageSettings) -> Result<u32, ServiceError> {
        let mut dbus_settings: HashMap<&str, zbus::zvariant::Value<'_>> = HashMap::new();

        if let Some(boot_device) = settings.boot_device.clone() {
            dbus_settings.insert("BootDevice", zbus::zvariant::Value::new(boot_device));
        }

        if let Some(encryption_password) = settings.encryption_password.clone() {
            dbus_settings.insert(
                "EncryptionPassword",
                zbus::zvariant::Value::new(encryption_password),
            );
        }

        if let Some(lvm) = settings.lvm {
            dbus_settings.insert("LVM", zbus::zvariant::Value::new(lvm));
        }

        Ok(self.calculator_proxy.calculate(dbus_settings).await?)
    }
}
