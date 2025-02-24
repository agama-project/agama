// Copyright (c) [2024-2025] SUSE LLC
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

//! Implements a client to access Agama's storage service.

use super::model::{
    Action, BlockDevice, Component, Device, DeviceInfo, DeviceSid, Drive, Filesystem, LvmLv, LvmVg,
    Md, Multipath, Partition, PartitionTable, ProposalSettings, ProposalSettingsPatch, Raid,
    Volume,
};
use super::proxies::{DevicesProxy, ProposalCalculatorProxy, ProposalProxy, Storage1Proxy};
use super::StorageSettings;
use crate::dbus::get_property;
use crate::error::ServiceError;
use serde_json::value::RawValue;
use std::collections::HashMap;
use zbus::fdo::ObjectManagerProxy;
use zbus::names::{InterfaceName, OwnedInterfaceName};
use zbus::zvariant::{OwnedObjectPath, OwnedValue};
use zbus::Connection;
pub mod dasd;
pub mod iscsi;
pub mod zfcp;

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
    devices_proxy: DevicesProxy<'a>,
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
                .cache_properties(zbus::proxy::CacheProperties::No)
                .build()
                .await?,
            // Same than above, actions are reexported with every call to recalculate
            devices_proxy: DevicesProxy::builder(&connection)
                .cache_properties(zbus::proxy::CacheProperties::No)
                .build()
                .await?,
            connection,
        })
    }

    /// Whether the devices have changed.
    pub async fn devices_dirty_bit(&self) -> Result<bool, ServiceError> {
        Ok(self.storage_proxy.deprecated_system().await?)
    }

    /// Actions to perform in the storage devices.
    pub async fn actions(&self) -> Result<Vec<Action>, ServiceError> {
        let actions = self.devices_proxy.actions().await?;
        let mut result: Vec<Action> = Vec::with_capacity(actions.len());

        for i in actions {
            result.push(i.try_into()?);
        }

        Ok(result)
    }

    /// SIDs of the devices available for the installation.
    pub async fn available_devices(&self) -> Result<Vec<DeviceSid>, ServiceError> {
        let paths: Vec<zbus::zvariant::ObjectPath> = self
            .calculator_proxy
            .available_devices()
            .await?
            .into_iter()
            .map(|p| p.into_inner())
            .collect();

        let result: Result<Vec<DeviceSid>, _> = paths.into_iter().map(|v| v.try_into()).collect();

        Ok(result?)
    }

    /// Default values for a volume with the given mount path.
    pub async fn volume_for(&self, mount_path: &str) -> Result<Volume, ServiceError> {
        let volume_hash = self.calculator_proxy.default_volume(mount_path).await?;

        Ok(volume_hash.try_into()?)
    }

    /// Mount points of the volumes pre-defined by the product.
    pub async fn product_mount_points(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.product_mount_points().await?)
    }

    /// Encryption methods allowed by the product.
    pub async fn encryption_methods(&self) -> Result<Vec<String>, ServiceError> {
        Ok(self.calculator_proxy.encryption_methods().await?)
    }

    /// Settings used for calculating the proposal.
    pub async fn proposal_settings(&self) -> Result<ProposalSettings, ServiceError> {
        Ok(self.proposal_proxy.settings().await?.try_into()?)
    }

    /// Runs the probing process
    pub async fn probe(&self) -> Result<(), ServiceError> {
        Ok(self.storage_proxy.probe().await?)
    }

    /// Runs the reprobing process
    pub async fn reprobe(&self) -> Result<(), ServiceError> {
        Ok(self.storage_proxy.reprobe().await?)
    }

    /// Set the storage config according to the JSON schema
    pub async fn set_config(&self, settings: StorageSettings) -> Result<u32, ServiceError> {
        Ok(self
            .storage_proxy
            .set_config(serde_json::to_string(&settings)?.as_str())
            .await?)
    }

    /// Reset the storage config to the default value
    pub async fn reset_config(&self) -> Result<u32, ServiceError> {
        Ok(self.storage_proxy.reset_config().await?)
    }

    /// Get the storage config according to the JSON schema
    pub async fn get_config(&self) -> Result<StorageSettings, ServiceError> {
        let serialized_settings = self.storage_proxy.get_config().await?;
        let settings = serde_json::from_str(serialized_settings.as_str())?;
        Ok(settings)
    }

    /// Set the storage config model according to the JSON schema
    pub async fn set_config_model(&self, model: Box<RawValue>) -> Result<u32, ServiceError> {
        Ok(self
            .storage_proxy
            .set_config_model(serde_json::to_string(&model).unwrap().as_str())
            .await?)
    }

    /// Get the storage config model according to the JSON schema
    pub async fn get_config_model(&self) -> Result<Box<RawValue>, ServiceError> {
        let serialized_config_model = self.storage_proxy.get_config_model().await?;
        let config_model = serde_json::from_str(serialized_config_model.as_str()).unwrap();
        Ok(config_model)
    }

    /// Solves the storage config model
    pub async fn solve_config_model(&self, model: &str) -> Result<Box<RawValue>, ServiceError> {
        let serialized_solved_model = self.storage_proxy.solve_config_model(model).await?;
        let solved_model = serde_json::from_str(serialized_solved_model.as_str()).unwrap();
        Ok(solved_model)
    }

    pub async fn calculate(&self, settings: ProposalSettingsPatch) -> Result<u32, ServiceError> {
        let map: HashMap<&str, zbus::zvariant::Value> = settings.into();
        let options: HashMap<&str, &zbus::zvariant::Value> =
            map.iter().map(|(id, value)| (*id, value)).collect();

        Ok(self.calculator_proxy.calculate(options).await?)
    }

    /// Probed devices.
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

    /// Resulting devices after calculating a proposal.
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
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Device");
        // All devices have to implement the Device interface, so report error if it is not there.
        let Some(properties) = iface else {
            return Err(zbus::zvariant::Error::Message(format!(
                "Storage device {} is missing the Device interface",
                object.0
            ))
            .into());
        };

        Ok(DeviceInfo {
            sid: get_property(properties, "SID")?,
            name: get_property(properties, "Name")?,
            description: get_property(properties, "Description")?,
        })
    }

    async fn build_block_device(
        &self,
        object: &DBusObject,
    ) -> Result<Option<BlockDevice>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Block");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(BlockDevice {
            active: get_property(properties, "Active")?,
            encrypted: get_property(properties, "Encrypted")?,
            size: get_property(properties, "Size")?,
            shrinking: get_property(properties, "Shrinking")?,
            start: get_property(properties, "Start")?,
            systems: get_property(properties, "Systems")?,
            udev_ids: get_property(properties, "UdevIds")?,
            udev_paths: get_property(properties, "UdevPaths")?,
        }))
    }

    async fn build_component(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Component>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Component");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Component {
            component_type: get_property(properties, "Type")?,
            device_names: get_property(properties, "DeviceNames")?,
            devices: get_property(properties, "Devices")?,
        }))
    }

    async fn build_drive(&self, object: &DBusObject) -> Result<Option<Drive>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Drive");
        let Some(properties) = iface else {
            return Ok(None);
        };

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
    }

    async fn build_filesystem(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Filesystem>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Filesystem");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Filesystem {
            sid: get_property(properties, "SID")?,
            fs_type: get_property(properties, "Type")?,
            mount_path: get_property(properties, "MountPath")?,
            label: get_property(properties, "Label")?,
        }))
    }

    async fn build_lvm_lv(&self, object: &DBusObject) -> Result<Option<LvmLv>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.LVM.LogicalVolume");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(LvmLv {
            volume_group: get_property(properties, "VolumeGroup")?,
        }))
    }

    async fn build_lvm_vg(&self, object: &DBusObject) -> Result<Option<LvmVg>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.LVM.VolumeGroup");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(LvmVg {
            size: get_property(properties, "Size")?,
            physical_volumes: get_property(properties, "PhysicalVolumes")?,
            logical_volumes: get_property(properties, "LogicalVolumes")?,
        }))
    }

    async fn build_md(&self, object: &DBusObject) -> Result<Option<Md>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.MD");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Md {
            uuid: get_property(properties, "UUID")?,
            level: get_property(properties, "Level")?,
            devices: get_property(properties, "Devices")?,
        }))
    }

    async fn build_multipath(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Multipath>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Multipath");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Multipath {
            wires: get_property(properties, "Wires")?,
        }))
    }

    async fn build_partition(
        &self,
        object: &DBusObject,
    ) -> Result<Option<Partition>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.Partition");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Partition {
            device: get_property(properties, "Device")?,
            efi: get_property(properties, "EFI")?,
        }))
    }

    async fn build_partition_table(
        &self,
        object: &DBusObject,
    ) -> Result<Option<PartitionTable>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.PartitionTable");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(PartitionTable {
            ptable_type: get_property(properties, "Type")?,
            partitions: get_property(properties, "Partitions")?,
            unused_slots: get_property(properties, "UnusedSlots")?,
        }))
    }

    async fn build_raid(&self, object: &DBusObject) -> Result<Option<Raid>, ServiceError> {
        let iface = self.get_interface(object, "org.opensuse.Agama.Storage1.RAID");
        let Some(properties) = iface else {
            return Ok(None);
        };

        Ok(Some(Raid {
            devices: get_property(properties, "Devices")?,
        }))
    }
}
