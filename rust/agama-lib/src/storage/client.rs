//! Implements a client to access Agama's storage service.

use super::device::{BlockDevice, Device, DeviceInfo};
use super::proxies::{DeviceProxy, ProposalCalculatorProxy, ProposalProxy, Storage1Proxy};
use super::StorageSettings;
use crate::dbus::{get_optional_property, get_property};
use crate::error::ServiceError;
use anyhow::{anyhow, Context};
use futures_util::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use zbus::fdo::ObjectManagerProxy;
use zbus::names::{InterfaceName, OwnedInterfaceName};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;

/// Represents a storage device
#[derive(Serialize, Debug)]
pub struct StorageDevice {
    name: String,
    description: String,
}

/// Represents a single change action done to storage
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    device: String,
    text: String,
    subvol: bool,
    delete: bool,
}

/// Represents value for target key of Volume
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum VolumeTarget {
    Default,
    NewPartition,
    NewVg,
    Device,
    Filesystem,
}

impl TryFrom<zbus::zvariant::Value<'_>> for VolumeTarget {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let svalue: String = value.try_into()?;
        match svalue.as_str() {
            "default" => Ok(VolumeTarget::Default),
            "new_partition" => Ok(VolumeTarget::NewPartition),
            "new_vg" => Ok(VolumeTarget::NewVg),
            "device" => Ok(VolumeTarget::Device),
            "filesystem" => Ok(VolumeTarget::Filesystem),
            _ => Err(zbus::zvariant::Error::Message(
                format!("Wrong value for Target: {}", svalue).to_string(),
            )),
        }
    }
}

/// Represents volume outline aka requirements for volume
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VolumeOutline {
    required: bool,
    fs_types: Vec<String>,
    support_auto_size: bool,
    snapshots_configurable: bool,
    snaphosts_affect_sizes: bool,
    size_relevant_volumes: Vec<String>,
}

impl TryFrom<zbus::zvariant::Value<'_>> for VolumeOutline {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let mvalue: HashMap<String, OwnedValue> = value.try_into()?;
        let res = VolumeOutline {
            required: get_property(&mvalue, "Required")?,
            fs_types: get_property(&mvalue, "FsTypes")?,
            support_auto_size: get_property(&mvalue, "SupportAutoSize")?,
            snapshots_configurable: get_property(&mvalue, "SnapshotsConfigurable")?,
            snaphosts_affect_sizes: get_property(&mvalue, "SnapshotsAffectSizes")?,
            size_relevant_volumes: get_property(&mvalue, "SizeRelevantVolumes")?,
        };

        Ok(res)
    }
}

/// Represents a single volume
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    mount_path: String,
    mount_options: Vec<String>,
    target: VolumeTarget,
    target_device: Option<String>,
    min_size: u64,
    max_size: Option<u64>,
    auto_size: bool,
    snapshots: Option<bool>,
    transactional: Option<bool>,
    outline: Option<VolumeOutline>,
}

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

    /// Returns the proposal proxy
    ///
    /// The proposal might not exist.
    // NOTE: should we implement some kind of memoization?
    async fn proposal_proxy(&self) -> Result<ProposalProxy<'a>, ServiceError> {
        Ok(ProposalProxy::new(&self.connection).await?)
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

    async fn build_device(
        &self,
        object: &(
            OwnedObjectPath,
            HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
        ),
    ) -> Result<Device, ServiceError> {
        let interfaces = &object.1;
        Ok(Device {
            device_info: self.build_device_info(interfaces).await?,
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
        let objects = self
            .object_manager_proxy
            .get_managed_objects()
            .await
            .context("Failed to get managed objects")?;
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
        let objects = self
            .object_manager_proxy
            .get_managed_objects()
            .await
            .context("Failed to get managed objects")?;
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
        interfaces: &HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
    ) -> Result<DeviceInfo, ServiceError> {
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
            Err(ServiceError::Anyhow(anyhow!(
                "Device does not implement device info"
            )))
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
