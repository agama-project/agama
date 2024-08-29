use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use zbus::zvariant::{OwnedValue, Value};

use crate::dbus::{get_optional_property, get_property};

pub mod dasd;
pub mod zfcp;

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DeviceSid(u32);

impl From<u32> for DeviceSid {
    fn from(sid: u32) -> Self {
        DeviceSid(sid)
    }
}

impl TryFrom<i32> for DeviceSid {
    type Error = zbus::zvariant::Error;

    fn try_from(value: i32) -> Result<Self, Self::Error> {
        u32::try_from(value)
            .map(|v| v.into())
            .map_err(|_| Self::Error::Message(format!("Cannot convert sid from {}", value)))
    }
}

impl TryFrom<zbus::zvariant::Value<'_>> for DeviceSid {
    type Error = zbus::zvariant::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value {
            Value::ObjectPath(path) => path.try_into(),
            Value::U32(v) => Ok(v.into()),
            Value::I32(v) => v.try_into(),
            _ => Err(Self::Error::Message(format!(
                "Cannot convert sid from {}",
                value
            ))),
        }
    }
}

impl TryFrom<zbus::zvariant::ObjectPath<'_>> for DeviceSid {
    type Error = zbus::zvariant::Error;

    fn try_from(path: zbus::zvariant::ObjectPath) -> Result<Self, Self::Error> {
        path.as_str()
            .rsplit_once('/')
            .and_then(|(_, sid)| sid.parse::<u32>().ok())
            .ok_or_else(|| Self::Error::Message(format!("Cannot parse sid from {}", path)))
            .map(DeviceSid)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DeviceSize(u64);

impl From<u64> for DeviceSize {
    fn from(value: u64) -> Self {
        DeviceSize(value)
    }
}

impl TryFrom<i64> for DeviceSize {
    type Error = zbus::zvariant::Error;

    fn try_from(value: i64) -> Result<Self, Self::Error> {
        u64::try_from(value)
            .map(|v| v.into())
            .map_err(|_| Self::Error::Message(format!("Cannot convert size from {}", value)))
    }
}

impl TryFrom<zbus::zvariant::Value<'_>> for DeviceSize {
    type Error = zbus::zvariant::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        match value {
            Value::U32(v) => Ok(u64::from(v).into()),
            Value::U64(v) => Ok(v.into()),
            Value::I32(v) => i64::from(v).try_into(),
            Value::I64(v) => v.try_into(),
            _ => Err(Self::Error::Message(format!(
                "Cannot convert size from {}",
                value
            ))),
        }
    }
}

impl<'a> From<DeviceSize> for zbus::zvariant::Value<'a> {
    fn from(val: DeviceSize) -> Self {
        Value::new(val.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
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

impl ProposalTarget {
    pub fn as_dbus_string(&self) -> String {
        match &self {
            ProposalTarget::Disk => "disk",
            ProposalTarget::NewLvmVg => "newLvmVg",
            ProposalTarget::ReusedLvmVg => "reusedLvmVg",
        }
        .to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum SpaceAction {
    ForceDelete,
    Resize,
}

impl SpaceAction {
    pub fn as_dbus_string(&self) -> String {
        match &self {
            Self::ForceDelete => "force_delete",
            Self::Resize => "resize",
        }
        .to_string()
    }
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

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
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

impl<'a> From<SpaceActionSettings> for zbus::zvariant::Value<'a> {
    fn from(val: SpaceActionSettings) -> Self {
        let result: HashMap<&str, Value> = HashMap::from([
            ("Device", Value::new(val.device)),
            ("Action", Value::new(val.action.as_dbus_string())),
        ]);

        Value::new(result)
    }
}

/// Represents a proposal patch -> change of proposal configuration that can be partial
#[derive(Debug, Clone, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSettingsPatch {
    pub target: Option<ProposalTarget>,
    pub target_device: Option<String>,
    #[serde(rename = "targetPVDevices")]
    pub target_pv_devices: Option<Vec<String>>,
    pub configure_boot: Option<bool>,
    pub boot_device: Option<String>,
    pub encryption_password: Option<String>,
    pub encryption_method: Option<String>,
    #[serde(rename = "encryptionPBKDFunction")]
    pub encryption_pbkd_function: Option<String>,
    pub space_policy: Option<String>,
    pub space_actions: Option<Vec<SpaceActionSettings>>,
    pub volumes: Option<Vec<Volume>>,
}

impl<'a> From<ProposalSettingsPatch> for HashMap<&'static str, Value<'a>> {
    fn from(val: ProposalSettingsPatch) -> Self {
        let mut result = HashMap::new();
        if let Some(target) = val.target {
            result.insert("Target", Value::new(target.as_dbus_string()));
        }
        if let Some(dev) = val.target_device {
            result.insert("TargetDevice", Value::new(dev));
        }
        if let Some(devs) = val.target_pv_devices {
            result.insert("TargetPVDevices", Value::new(devs));
        }
        if let Some(value) = val.configure_boot {
            result.insert("ConfigureBoot", Value::new(value));
        }
        if let Some(value) = val.boot_device {
            result.insert("BootDevice", Value::new(value));
        }
        if let Some(value) = val.encryption_password {
            result.insert("EncryptionPassword", Value::new(value));
        }
        if let Some(value) = val.encryption_method {
            result.insert("EncryptionMethod", Value::new(value));
        }
        if let Some(value) = val.encryption_pbkd_function {
            result.insert("EncryptionPBKDFunction", Value::new(value));
        }
        if let Some(value) = val.space_policy {
            result.insert("SpacePolicy", Value::new(value));
        }
        if let Some(value) = val.space_actions {
            let list: Vec<Value> = value.into_iter().map(|a| a.into()).collect();
            result.insert("SpaceActions", Value::new(list));
        }
        if let Some(value) = val.volumes {
            let list: Vec<Value> = value.into_iter().map(|a| a.into()).collect();
            result.insert("Volumes", Value::new(list));
        }
        result
    }
}

/// Represents a proposal configuration
#[derive(Debug, Clone, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ProposalSettings {
    pub target: ProposalTarget,
    pub target_device: Option<String>,
    #[serde(rename = "targetPVDevices")]
    pub target_pv_devices: Option<Vec<String>>,
    pub configure_boot: bool,
    pub boot_device: String,
    pub default_boot_device: String,
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
            default_boot_device: get_property(&hash, "DefaultBootDevice")?,
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
    device: DeviceSid,
    text: String,
    subvol: bool,
    delete: bool,
    resize: bool,
}

impl TryFrom<HashMap<String, OwnedValue>> for Action {
    type Error = zbus::zvariant::Error;

    fn try_from(hash: HashMap<String, OwnedValue>) -> Result<Self, zbus::zvariant::Error> {
        let res = Action {
            device: get_property(&hash, "Device")?,
            text: get_property(&hash, "Text")?,
            subvol: get_property(&hash, "Subvol")?,
            delete: get_property(&hash, "Delete")?,
            resize: get_property(&hash, "Resize")?,
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

impl<'a> From<VolumeTarget> for zbus::zvariant::Value<'a> {
    fn from(val: VolumeTarget) -> Self {
        let str = match val {
            VolumeTarget::Default => "default",
            VolumeTarget::NewPartition => "new_partition",
            VolumeTarget::NewVg => "new_vg",
            VolumeTarget::Device => "device",
            VolumeTarget::Filesystem => "filesystem",
        };

        Value::new(str)
    }
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
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct VolumeOutline {
    required: bool,
    fs_types: Vec<String>,
    support_auto_size: bool,
    adjust_by_ram: bool,
    snapshots_configurable: bool,
    snapshots_affect_sizes: bool,
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
            adjust_by_ram: get_property(&mvalue, "AdjustByRam")?,
            snapshots_configurable: get_property(&mvalue, "SnapshotsConfigurable")?,
            snapshots_affect_sizes: get_property(&mvalue, "SnapshotsAffectSizes")?,
            size_relevant_volumes: get_property(&mvalue, "SizeRelevantVolumes")?,
        };

        Ok(res)
    }
}

/// Represents a single volume
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Volume {
    mount_path: String,
    mount_options: Vec<String>,
    target: VolumeTarget,
    target_device: Option<String>,
    fs_type: String,
    min_size: Option<DeviceSize>,
    max_size: Option<DeviceSize>,
    auto_size: bool,
    snapshots: bool,
    transactional: Option<bool>,
    outline: Option<VolumeOutline>,
}

impl<'a> From<Volume> for zbus::zvariant::Value<'a> {
    fn from(val: Volume) -> Self {
        let mut result: HashMap<&str, Value> = HashMap::from([
            ("MountPath", Value::new(val.mount_path)),
            ("MountOptions", Value::new(val.mount_options)),
            ("Target", val.target.into()),
            ("FsType", Value::new(val.fs_type)),
            ("AutoSize", Value::new(val.auto_size)),
            ("Snapshots", Value::new(val.snapshots)),
        ]);
        if let Some(dev) = val.target_device {
            result.insert("TargetDevice", Value::new(dev));
        }
        if let Some(value) = val.min_size {
            result.insert("MinSize", value.into());
        }
        if let Some(value) = val.max_size {
            result.insert("MaxSize", value.into());
        }
        // intentionally skip outline as it is not send to dbus and act as read only parameter
        Value::new(result)
    }
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
            fs_type: get_property(&volume_hash, "FsType")?,
            min_size: get_optional_property(&volume_hash, "MinSize")?,
            max_size: get_optional_property(&volume_hash, "MaxSize")?,
            auto_size: get_property(&volume_hash, "AutoSize")?,
            snapshots: get_property(&volume_hash, "Snapshots")?,
            transactional: get_optional_property(&volume_hash, "Transactional")?,
            outline: get_optional_property(&volume_hash, "Outline")?,
        };

        Ok(res)
    }
}

/// Information about system device created by composition to reflect different devices on system
// FIXME Device schema is not generated because it collides with the network Device.
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
    pub md: Option<Md>,
    pub multipath: Option<Multipath>,
    pub partition: Option<Partition>,
    pub partition_table: Option<PartitionTable>,
    pub raid: Option<Raid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
pub struct DeviceInfo {
    pub sid: DeviceSid,
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BlockDevice {
    pub active: bool,
    pub encrypted: bool,
    pub size: DeviceSize,
    pub shrinking: ShrinkingInfo,
    pub start: u64,
    pub systems: Vec<String>,
    pub udev_ids: Vec<String>,
    pub udev_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum ShrinkingInfo {
    Supported(DeviceSize),
    Unsupported(Vec<String>),
}

impl TryFrom<zbus::zvariant::Value<'_>> for ShrinkingInfo {
    type Error = zbus::zvariant::Error;

    fn try_from(value: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let hash: HashMap<String, OwnedValue> = value.clone().try_into()?;
        let mut info: Option<Self> = None;

        if let Some(size) = get_optional_property(&hash, "Supported")? {
            info = Some(Self::Supported(size));
        }
        if let Some(reasons) = get_optional_property(&hash, "Unsupported")? {
            info = Some(Self::Unsupported(reasons));
        }

        info.ok_or(Self::Error::Message(format!(
            "Wrong value for Shrinking: {}",
            value
        )))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Component {
    #[serde(rename = "type")]
    pub component_type: String,
    pub device_names: Vec<String>,
    pub devices: Vec<DeviceSid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Drive {
    #[serde(rename = "type")]
    pub drive_type: String,
    pub vendor: String,
    pub model: String,
    pub bus: String,
    pub bus_id: String,
    pub driver: Vec<String>,
    pub transport: String,
    pub info: DriveInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DriveInfo {
    pub sd_card: bool,
    #[serde(rename = "dellBOSS")]
    pub dell_boss: bool,
}

impl TryFrom<zbus::zvariant::Value<'_>> for DriveInfo {
    type Error = zbus::zvariant::Error;

    fn try_from(object: zbus::zvariant::Value) -> Result<Self, zbus::zvariant::Error> {
        let hash: HashMap<String, OwnedValue> = object.try_into()?;

        hash.try_into()
    }
}

impl TryFrom<HashMap<String, OwnedValue>> for DriveInfo {
    type Error = zbus::zvariant::Error;

    fn try_from(info_hash: HashMap<String, OwnedValue>) -> Result<Self, zbus::zvariant::Error> {
        let res = DriveInfo {
            sd_card: get_property(&info_hash, "SDCard")?,
            dell_boss: get_property(&info_hash, "DellBOSS")?,
        };

        Ok(res)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Filesystem {
    pub sid: DeviceSid,
    #[serde(rename = "type")]
    pub fs_type: String,
    pub mount_path: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LvmLv {
    pub volume_group: DeviceSid,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LvmVg {
    pub size: DeviceSize,
    pub physical_volumes: Vec<DeviceSid>,
    pub logical_volumes: Vec<DeviceSid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Md {
    pub uuid: String,
    pub level: String,
    pub devices: Vec<DeviceSid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Multipath {
    pub wires: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Partition {
    pub device: DeviceSid,
    pub efi: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PartitionTable {
    #[serde(rename = "type")]
    pub ptable_type: String,
    pub partitions: Vec<DeviceSid>,
    pub unused_slots: Vec<UnusedSlot>,
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UnusedSlot {
    pub start: u64,
    pub size: DeviceSize,
}

impl TryFrom<zbus::zvariant::Value<'_>> for UnusedSlot {
    type Error = zbus::zvariant::Error;

    fn try_from(value: Value) -> Result<Self, Self::Error> {
        let slot_info: (u64, u64) = value.try_into()?;

        Ok(UnusedSlot {
            start: slot_info.0,
            size: slot_info.1.into(),
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Raid {
    pub devices: Vec<String>,
}
