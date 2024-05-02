use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use zbus::zvariant::OwnedValue;

use crate::dbus::get_property;

/// Represents a storage device
#[derive(Serialize, Debug)]
pub struct StorageDevice {
    pub name: String,
    pub description: String,
}

/// Represents a single change action done to storage
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Action {
    pub device: String,
    pub text: String,
    pub subvol: bool,
    pub delete: bool,
}

/// Represents value for target key of Volume
/// It is snake cased when serializing to be compatible with yast2-storage-ng.
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
    pub mount_path: String,
    pub mount_options: Vec<String>,
    pub target: VolumeTarget,
    pub target_device: Option<String>,
    pub min_size: u64,
    pub max_size: Option<u64>,
    pub auto_size: bool,
    pub snapshots: Option<bool>,
    pub transactional: Option<bool>,
    pub outline: Option<VolumeOutline>,
}

/// Information about system device created by composition to reflect different devices on system
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub device_info: DeviceInfo,
    pub block_device: Option<BlockDevice>,
    pub component: Option<Component>,
    pub drive: Option<Drive>,
    pub filesystem: Option<Filesystem>,
    pub lvm_lv: Option<LvmLv>,
    pub lvm_vg: Option<LvmVg>,
    pub md: Option<MD>,
    pub multipath: Option<Multipath>,
    pub partition: Option<Partition>,
    pub partition_table: Option<PartitionTable>,
    pub raid: Option<Raid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DeviceInfo {
    pub sid: u32,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BlockDevice {
    pub active: bool,
    pub encrypted: bool,
    pub recoverable_size: u64,
    pub size: u64,
    pub start: u64,
    pub systems: Vec<String>,
    pub udev_ids: Vec<String>,
    pub udev_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Component {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Drive {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Filesystem {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct LvmLv {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct LvmVg {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct MD {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Multipath {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Partition {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct PartitionTable {}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct Raid {}
