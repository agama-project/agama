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

//! This module implements support for the so-called Jobs. It is a concept hat represents running
//! an external command that may take some time, like formatting a DASD device. It is exposed via
//! D-Bus and, at this time, only the storage service makes use of it.

use std::collections::HashMap;

use serde::Serialize;
use zbus::zvariant::OwnedValue;

use crate::{dbus::get_property, error::ServiceError};

pub mod client;

/// Represents a job.
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    /// Artificial job identifier.
    pub id: String,
    /// Whether the job is running.
    pub running: bool,
    /// Job exit code.
    pub exit_code: u32,
}

impl TryFrom<&HashMap<String, OwnedValue>> for Job {
    type Error = ServiceError;

    fn try_from(value: &HashMap<String, OwnedValue>) -> Result<Self, Self::Error> {
        Ok(Job {
            running: get_property(value, "Running")?,
            exit_code: get_property(value, "ExitCode")?,
            ..Default::default()
        })
    }
}
