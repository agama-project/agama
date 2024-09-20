// Copyright (c) [2024] SUSE LLC
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

//! Implements a data model for DASD devices management.
use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::OwnedValue;

use crate::{dbus::get_property, error::ServiceError};

/// Represents a DASD device (specific to s390x systems).
#[derive(Clone, Debug, Serialize, Default, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
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
#[derive(Clone, Debug, Serialize, Default, utoipa::ToSchema)]
pub struct DASDFormatSummary {
    pub total: u32,
    pub step: u32,
    pub done: bool,
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
