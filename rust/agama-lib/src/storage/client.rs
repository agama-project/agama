//! Implements a client to access Agama's storage service.

use super::model::{Action, BlockDevice, Device, DeviceInfo, StorageDevice, Volume};
use super::proxies::{DeviceProxy, ProposalCalculatorProxy, ProposalProxy, Storage1Proxy};
use super::StorageSettings;
use crate::dbus::{get_optional_property, get_property};
use crate::error::ServiceError;
use futures_util::future::join_all;
use std::collections::HashMap;
use zbus::fdo::ObjectManagerProxy;
use zbus::names::{InterfaceName, OwnedInterfaceName};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;

/// D-Bus client for the storage service
#[derive(Clone)]
pub struct StorageClient<'a> {
    pub connection: Connection,
    calculator_proxy: ProposalCalculatorProxy<'a>,
    storage_proxy: Storage1Proxy<'a>,
    object_manager_proxy: ObjectManagerProxy<'a>,
    proposal_proxy: ProposalProxy<'a>,
}

impl<'a> StorageClient<'a> {
    pub async fn new(connection: Connection) -> Result<StorageClient<'a>, ServiceError> {
        Ok(Self {
            calculator_proxy: ProposalCalculatorProxy::new(&connection).await?,
            storage_proxy: Storage1Proxy::new(&connection).await?,
            object_manager_proxy: ObjectManagerProxy::builder(&connection)
                .destination("org.opensuse.Agama.Storage1")?
                .path("/org/opensuse/Agama/Storage1")?
                .build()
                .await?,
            proposal_proxy: ProposalProxy::new(&connection).await?,
            connection,
        })
    }

    pub async fn devices_dirty_bit(&self) -> Result<bool, ServiceError> {
        Ok(self.storage_proxy.deprecated_system().await?)
    }

    pub async fn actions(&self) -> Result<Vec<Action>, ServiceError> {
        let actions = self.proposal_proxy.actions().await?;
        let mut result: Vec<Action> = Vec::with_capacity(actions.len());

        for i in actions {
            let action = Action {
                device: get_property(&i, "Device")?,
                text: get_property(&i, "Text")?,
                subvol: get_property(&i, "Subvol")?,
                delete: get_property(&i, "Delete")?,
            };
            result.push(action);
        }

        Ok(result)
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

    pub async fn volume_for(&self, mount_path: &str) -> Result<Volume, ServiceError> {
        let volume_hash = self.calculator_proxy.default_volume(mount_path).await?;
        let volume = Volume {
            mount_path: get_property(&volume_hash, "MountPath")?,
            mount_options: get_property(&volume_hash, "MountOptions")?,
            target: get_property(&volume_hash, "Target")?,
            target_device: get_optional_property(&volume_hash, "TargetDevice")?,
            min_size: get_property(&volume_hash, "MinSize")?,
            max_size: get_optional_property(&volume_hash, "MaxSize")?,
            auto_size: get_property(&volume_hash, "AutoSize")?,
            snapshots: get_optional_property(&volume_hash, "Snapshots")?,
            transactional: get_optional_property(&volume_hash, "Transactional")?,
            outline: get_optional_property(&volume_hash, "Outline")?,
        };

        Ok(volume)
    }

    pub async fn product_mount_points(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.product_mount_points().await?)
    }

    pub async fn encryption_methods(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.encryption_methods().await?)
    }

    /// Returns the storage device for the given D-Bus path
    async fn storage_device(
        &self,
        dbus_path: OwnedObjectPath,
    ) -> Result<StorageDevice, ServiceError> {
        let proxy = DeviceProxy::builder(&self.connection)
            .path(dbus_path)?
            .build()
            .await?;

        Ok(StorageDevice {
            name: proxy.name().await?,
            description: proxy.description().await?,
        })
    }

    /// Returns the boot device proposal setting
    pub async fn boot_device(&self) -> Result<Option<String>, ServiceError> {
        let value = self.proposal_value(self.proposal_proxy.boot_device().await)?;

        match value {
            Some(v) if v.is_empty() => Ok(None),
            Some(v) => Ok(Some(v)),
            None => Ok(None),
        }
    }

    /// Returns the lvm proposal setting
    pub async fn lvm(&self) -> Result<Option<bool>, ServiceError> {
        self.proposal_value(self.proposal_proxy.lvm().await)
    }

    /// Returns the encryption password proposal setting
    pub async fn encryption_password(&self) -> Result<Option<String>, ServiceError> {
        let value = self.proposal_value(self.proposal_proxy.encryption_password().await)?;

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

    async fn build_device(
        &self,
        object: &(
            OwnedObjectPath,
            HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
        ),
    ) -> Result<Device, ServiceError> {
        let interfaces = &object.1;
        Ok(Device {
            device_info: self.build_device_info(object).await?,
            component: None,
            drive: None,
            block_device: self.build_block_device(interfaces).await?,
            filesystem: None,
            lvm_lv: None,
            lvm_vg: None,
            md: None,
            multipath: None,
            partition: None,
            partition_table: None,
            raid: None,
        })
    }

    pub async fn system_devices(&self) -> Result<Vec<Device>, ServiceError> {
        let objects = self.object_manager_proxy.get_managed_objects().await?;
        let mut result = vec![];
        for object in objects {
            let path = &object.0;
            if !path.as_str().contains("Storage1/system") {
                continue;
            }

            result.push(self.build_device(&object).await?)
        }

        Ok(result)
    }

    pub async fn staging_devices(&self) -> Result<Vec<Device>, ServiceError> {
        let objects = self.object_manager_proxy.get_managed_objects().await?;
        let mut result = vec![];
        for object in objects {
            let path = &object.0;
            if !path.as_str().contains("Storage1/staging") {
                continue;
            }

            result.push(self.build_device(&object).await?)
        }

        Ok(result)
    }

    async fn build_device_info(
        &self,
        object: &(
            OwnedObjectPath,
            HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
        ),
    ) -> Result<DeviceInfo, ServiceError> {
        let interfaces = &object.1;
        let interface: OwnedInterfaceName =
            InterfaceName::from_static_str_unchecked("org.opensuse.Agama.Storage1.Device").into();
        let properties = interfaces.get(&interface);
        // All devices has to implement device info, so report error if it is not there
        if let Some(properties) = properties {
            Ok(DeviceInfo {
                sid: get_property(properties, "SID")?,
                name: get_property(properties, "Name")?,
                description: get_property(properties, "Description")?,
            })
        } else {
            let message =
                format!("storage device {} is missing Device interface", object.0).to_string();
            Err(zbus::zvariant::Error::Message(message).into())
        }
    }

    async fn build_block_device(
        &self,
        interfaces: &HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
    ) -> Result<Option<BlockDevice>, ServiceError> {
        let interface: OwnedInterfaceName =
            InterfaceName::from_static_str_unchecked("org.opensuse.Agama.Storage1.Block").into();
        let properties = interfaces.get(&interface);
        if let Some(properties) = properties {
            Ok(Some(BlockDevice {
                active: get_property(properties, "Active")?,
                encrypted: get_property(properties, "Encrypted")?,
                recoverable_size: get_property(properties, "RecoverableSize")?,
                size: get_property(properties, "Size")?,
                start: get_property(properties, "Start")?,
                systems: get_property(properties, "Systems")?,
                udev_ids: get_property(properties, "UdevIds")?,
                udev_paths: get_property(properties, "UdevPaths")?,
            }))
        } else {
            Ok(None)
        }
    }
}
