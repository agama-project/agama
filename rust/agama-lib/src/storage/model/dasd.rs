//! Implements a data model for DASD devices management.
use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::OwnedValue;

use crate::{dbus::get_property, error::ServiceError};

/// Represents a DASD device (specific to s390x systems).
#[derive(Clone, Debug, Serialize, Default, utoipa::ToSchema)]
pub struct DASDDevice {
    pub id: String,
    pub enabled: bool,
    pub device_name: String,
    pub formatted: bool,
    pub diag: bool,
    pub status: String,
    pub device_type: String,
    pub access_type: String,
    pub partition_info: String,
}

impl TryFrom<&HashMap<String, OwnedValue>> for DASDDevice {
    type Error = ServiceError;

    fn try_from(value: &HashMap<String, OwnedValue>) -> Result<Self, Self::Error> {
        Ok(DASDDevice {
            id: get_property(value, "Id")?,
            enabled: get_property(value, "Enabled")?,
            device_name: get_property(value, "DeviceName")?,
            formatted: get_property(value, "Formatted")?,
            diag: get_property(value, "Diag")?,
            status: get_property(value, "Status")?,
            device_type: get_property(value, "Type")?,
            access_type: get_property(value, "AccessType")?,
            partition_info: get_property(value, "PartitionInfo")?,
        })
    }
}
