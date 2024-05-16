//! Implements a client to access Agama's storage service.

use super::model::{
    Action, BlockDevice, Component, Device, DeviceInfo, Drive, Filesystem, LvmLv, LvmVg, Md,
    Multipath, Partition, PartitionTable, ProposalSettings, ProposalSettingsPatch, ProposalTarget,
    Raid, StorageDevice, Volume,
};
use super::proxies::{DeviceProxy, ProposalCalculatorProxy, ProposalProxy, Storage1Proxy};
use super::StorageSettings;
use crate::dbus::get_property;
use crate::error::ServiceError;
use futures_util::future::join_all;
use std::collections::HashMap;
use zbus::fdo::ObjectManagerProxy;
use zbus::names::{InterfaceName, OwnedInterfaceName};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;
pub mod iscsi;

type DBusObject = (
    OwnedObjectPath,
    HashMap<OwnedInterfaceName, HashMap<std::string::String, OwnedValue>>,
);

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
            // Do not cache the D-Bus proposal proxy because the proposal object is reexported with
            // every new call to calculate.
            proposal_proxy: ProposalProxy::builder(&connection)
                .cache_properties(zbus::CacheProperties::No)
                .build()
                .await?,
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
            result.push(i.try_into()?);
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

        Ok(volume_hash.try_into()?)
    }

    pub async fn product_mount_points(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.product_mount_points().await?)
    }

    pub async fn encryption_methods(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.encryption_methods().await?)
    }

    pub async fn proposal_settings(&self) -> Result<ProposalSettings, ServiceError> {
        Ok(self.proposal_proxy.settings().await?.try_into()?)
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
    /// DEPRECATED, use proposal_settings instead
    pub async fn boot_device(&self) -> Result<Option<String>, ServiceError> {
        let settings = self.proposal_settings().await?;
        let boot_device = settings.boot_device;

        if boot_device.is_empty() {
            Ok(None)
        } else {
            Ok(Some(boot_device))
        }
    }

    /// Returns the lvm proposal setting
    /// DEPRECATED, use proposal_settings instead
    pub async fn lvm(&self) -> Result<Option<bool>, ServiceError> {
        let settings = self.proposal_settings().await?;
        Ok(Some(!matches!(settings.target, ProposalTarget::Disk)))
    }

    /// Returns the encryption password proposal setting
    /// DEPRECATED, use proposal_settings instead
    pub async fn encryption_password(&self) -> Result<Option<String>, ServiceError> {
        let settings = self.proposal_settings().await?;
        let value = settings.encryption_password;

        if value.is_empty() {
            Ok(None)
        } else {
            Ok(Some(value))
        }
    }

    /// Runs the probing process
    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.storage_proxy.probe().await?)
    }

    /// TODO: remove calculate when CLI will be adapted
    pub async fn calculate2(&self, settings: ProposalSettingsPatch) -> Result<u32, ServiceError> {
        Ok(self.calculator_proxy.calculate(settings.into()).await?)
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

    fn get_interface<'b>(
        &'b self,
        object: &'b DBusObject,
        name: &str,
    ) -> Option<&HashMap<String, OwnedValue>> {
        let interface: OwnedInterfaceName = InterfaceName::from_str_unchecked(name).into();
        let interfaces = &object.1;
        interfaces.get(&interface)
    }

    async fn build_device(&self, object: &DBusObject) -> Result<Device, ServiceError> {
        Ok(Device {
            block_device: self.build_block_device(object).await?,
            component: self.build_component(object).await?,
            device_info: self.build_device_info(object).await?,
            drive: self.build_drive(object).await?,
            filesystem: self.build_filesystem(object).await?,
            lvm_lv: self.build_lvm_lv(object).await?,
            lvm_vg: self.build_lvm_vg(object).await?,
            md: self.build_md(object).await?,
            multipath: self.build_multipath(object).await?,
            partition: self.build_partition(object).await?,
            partition_table: self.build_partition_table(object).await?,
            raid: self.build_raid(object).await?,
        })
    }

    async fn build_device_info(&self, object: &DBusObject) -> Result<DeviceInfo, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Device");
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
        object: &DBusObject,
    ) -> Result<Option<BlockDevice>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Block");

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

    async fn build_component(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Component>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Component");

        if let Some(properties) = properties {
            Ok(Some(Component {
                component_type: get_property(properties, "Type")?,
                device_names: get_property(properties, "DeviceNames")?,
                devices: get_property(properties, "Devices")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_drive(&self, object: &DBusObject) -> Result<Option<Drive>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Drive");

        if let Some(properties) = properties {
            Ok(Some(Drive {
                drive_type: get_property(properties, "Type")?,
                vendor: get_property(properties, "Vendor")?,
                model: get_property(properties, "Model")?,
                bus: get_property(properties, "Bus")?,
                bus_id: get_property(properties, "BusId")?,
                driver: get_property(properties, "Driver")?,
                transport: get_property(properties, "Transport")?,
                info: get_property(properties, "Info")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_filesystem(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Filesystem>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Filesystem");

        if let Some(properties) = properties {
            Ok(Some(Filesystem {
                sid: get_property(properties, "SID")?,
                fs_type: get_property(properties, "Type")?,
                mount_path: get_property(properties, "MountPath")?,
                label: get_property(properties, "Label")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_lvm_lv(&self, object: &DBusObject) -> Result<Option<LvmLv>, ServiceError> {
        let properties =
            self.get_interface(object, "org.opensuse.Agama.Storage1.LVM.LogicalVolume");

        if let Some(properties) = properties {
            Ok(Some(LvmLv {
                volume_group: get_property(properties, "VolumeGroup")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_lvm_vg(&self, object: &DBusObject) -> Result<Option<LvmVg>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.LVM.VolumeGroup");

        if let Some(properties) = properties {
            Ok(Some(LvmVg {
                size: get_property(properties, "Size")?,
                physical_volumes: get_property(properties, "PhysicalVolumes")?,
                logical_volumes: get_property(properties, "LogicalVolumes")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_md(&self, object: &DBusObject) -> Result<Option<Md>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.MD");

        if let Some(properties) = properties {
            Ok(Some(Md {
                uuid: get_property(properties, "UUID")?,
                level: get_property(properties, "Level")?,
                devices: get_property(properties, "Devices")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_multipath(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Multipath>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Multipath");

        if let Some(properties) = properties {
            Ok(Some(Multipath {
                wires: get_property(properties, "Wires")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_partition(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Partition>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.Partition");

        if let Some(properties) = properties {
            Ok(Some(Partition {
                device: get_property(properties, "Device")?,
                efi: get_property(properties, "EFI")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_partition_table(
        &self,
        object: &DBusObject,
    ) -> Result<Option<PartitionTable>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.PartitionTable");

        if let Some(properties) = properties {
            Ok(Some(PartitionTable {
                ptable_type: get_property(properties, "Type")?,
                partitions: get_property(properties, "Partitions")?,
                unused_slots: get_property(properties, "UnusedSlots")?,
            }))
        } else {
            Ok(None)
        }
    }

    async fn build_raid(&self, object: &DBusObject) -> Result<Option<Raid>, ServiceError> {
        let properties = self.get_interface(object, "org.opensuse.Agama.Storage1.RAID");

        if let Some(properties) = properties {
            Ok(Some(Raid {
                devices: get_property(properties, "Devices")?,
            }))
        } else {
            Ok(None)
        }
    }
}
