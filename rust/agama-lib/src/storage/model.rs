use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use zbus::zvariant::OwnedValue;

use crate::dbus::{get_optional_property, get_property};

/// Represents a storage device
/// Just for backward compatibility with CLI.
/// See struct Device
#[derive(Serialize, Debug)]
pub struct StorageDevice {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
// note that dbus use camelCase for proposalTarget values and snake_case for volumeTarget
#[serde(rename_all = "camelCase")]
pub enum ProposalTarget {
    Disk,
    NewLvmVg,
    ReusedLvmVg,
}

impl TryFrom<zbus::zvariant::Value<'_>> for ProposalTarget {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let svalue: String = value.try_into()?;
        match svalue.as_str() {
            "disk" => Ok(Self::Disk),
            "newLvmVg" => Ok(Self::NewLvmVg),
            "reusedLvmVg" => Ok(Self::ReusedLvmVg),
            _ => Err(zbus::zvariant::Error::Message(
                format!("Wrong value for Target: {}", svalue).to_string(),
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SpaceAction {
    ForceDelete,
    Resize,
}

impl TryFrom<zbus::zvariant::Value<'_>> for SpaceAction {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let svalue: String = value.try_into()?;
        match svalue.as_str() {
            "force_delete" => Ok(Self::ForceDelete),
            "resize" => Ok(Self::Resize),
            _ => Err(zbus::zvariant::Error::Message(
                format!("Wrong value for SpacePolicy: {}", svalue).to_string(),
            )),
        }
    }
}

#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
pub struct SpaceActionSettings {
    pub device: String,
    pub action: SpaceAction,
}

impl TryFrom<zbus::zvariant::Value<'_>> for SpaceActionSettings {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let mvalue: HashMap<String, OwnedValue> = value.try_into()?;
        let res = SpaceActionSettings {
            device: get_property(&mvalue, "Device")?,
            action: get_property(&mvalue, "Action")?,
        };

        Ok(res)
    }
}

/// Represents a proposal configuration
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSettings {
    pub target: ProposalTarget,
    pub target_device: Option<String>,
    #[serde(rename = "targetPVDevices")]
    pub target_pv_devices: Option<String>,
    pub configure_boot: bool,
    pub boot_device: String,
    pub encryption_password: String,
    pub encryption_method: String,
    #[serde(rename = "encryptionPBKDFunction")]
    pub encryption_pbkd_function: String,
    pub space_policy: String,
    pub space_actions: Vec<SpaceActionSettings>,
    pub volumes: Vec<Volume>,
}

impl TryFrom<HashMap<String, OwnedValue>> for ProposalSettings {
    type Error = zbus::zvariant::Error;

    fn try_from(hash: HashMap<String, OwnedValue>) -> Result<Self, zbus::zvariant::Error> {
        let res = ProposalSettings {
            target: get_property(&hash, "Target")?,
            target_device: get_optional_property(&hash, "TargetDevice")?,
            target_pv_devices: get_optional_property(&hash, "TargetPVDevices")?,
            configure_boot: get_property(&hash, "ConfigureBoot")?,
            boot_device: get_property(&hash, "BootDevice")?,
            encryption_password: get_property(&hash, "EncryptionPassword")?,
            encryption_method: get_property(&hash, "EncryptionMethod")?,
            encryption_pbkd_function: get_property(&hash, "EncryptionPBKDFunction")?,
            space_policy: get_property(&hash, "SpacePolicy")?,
            space_actions: get_property(&hash, "SpaceActions")?,
            volumes: get_property(&hash, "Volumes")?,
        };

        Ok(res)
    }
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

impl TryFrom<HashMap<String, OwnedValue>> for Action {
    type Error = zbus::zvariant::Error;

    fn try_from(hash: HashMap<String, OwnedValue>) -> Result<Self, zbus::zvariant::Error> {
        let res = Action {
            device: get_property(&hash, "Device")?,
            text: get_property(&hash, "Text")?,
            subvol: get_property(&hash, "Subvol")?,
            delete: get_property(&hash, "Delete")?,
        };

        Ok(res)
    }
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

impl TryFrom<zbus::zvariant::Value<'_>> for Volume {
    type Error = zbus::zvariant::Error;

    fn try_from(object: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let hash: HashMap<String, OwnedValue> = object.try_into()?;

        hash.try_into()
    }
}

impl TryFrom<HashMap<String, OwnedValue>> for Volume {
    type Error = zbus::zvariant::Error;

    fn try_from(volume_hash: HashMap<String, OwnedValue>) -> Result<Self, zbus::zvariant::Error> {
        let res = Volume {
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

        Ok(res)
    }
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
