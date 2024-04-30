use serde::{Deserialize, Serialize};

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
