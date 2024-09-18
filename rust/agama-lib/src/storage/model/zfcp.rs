//! Implements a data model for zFCP devices management.
use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::OwnedValue;

use crate::{dbus::get_property, error::ServiceError};

/// Represents a zFCP disk (specific to s390x systems).
#[derive(Clone, Debug, Serialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ZFCPDisk {
    /// Name of the zFCP device (e.g., /dev/sda)
    pub name: String,
    /// zFCP controller channel id (e.g., 0.0.fa00)
    pub channel: String,
    /// WWPN of the targer port (e.g., 0x500507630300c562)
    pub wwpn: String,
    /// LUN of the SCSI device (e.g. 0x4010403300000000)
    pub lun: String,
}

impl TryFrom<&HashMap<String, OwnedValue>> for ZFCPDisk {
    type Error = ServiceError;

    fn try_from(value: &HashMap<String, OwnedValue>) -> Result<Self, Self::Error> {
        Ok(ZFCPDisk {
            name: get_property(value, "Name")?,
            channel: get_property(value, "Channel")?,
            wwpn: get_property(value, "WWPN")?,
            lun: get_property(value, "LUN")?,
        })
    }
}

/// Represents a zFCP controller (specific to s390x systems).
#[derive(Clone, Debug, Serialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ZFCPController {
    /// unique internal ID for given controller
    pub id: String,
    /// zFCP controller channel id (e.g., 0.0.fa00)
    pub channel: String,
    /// flag whenever channel is performing LUN auto scan
    pub lun_scan: bool,
    /// flag whenever channel is active
    pub active: bool,
    /// map of associated WWPNs and its LUNs
    pub luns_map: HashMap<String, Vec<String>>,
}
