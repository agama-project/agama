// Copyright (c) [2025] SUSE LLC
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

use crate::api::{iscsi, l10n};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, utoipa::ToSchema)]
pub enum Action {
    #[serde(rename = "discoverISCSI")]
    DiscoverISCSI(iscsi::DiscoverConfig),
    #[serde(rename = "activateStorage")]
    ActivateStorage,
    #[serde(rename = "probeStorage")]
    ProbeStorage,
    #[serde(rename = "configureL10n")]
    ConfigureL10n(l10n::SystemConfig),
    #[serde(rename = "install")]
    Install,
    #[serde(rename = "finish")]
    Finish(FinishMethod),
}

/// Finish method
#[derive(
    Default,
    Serialize,
    Deserialize,
    Debug,
    PartialEq,
    Eq,
    Clone,
    Copy,
    strum::Display,
    strum::EnumString,
    utoipa::ToSchema,
)]
#[strum(serialize_all = "camelCase")]
#[serde(rename_all = "camelCase")]
pub enum FinishMethod {
    // Halt the system
    Halt,
    // Reboots the system
    #[default]
    Reboot,
    // Do nothing at the end of the installation
    Stop,
    // Poweroff the system
    Poweroff,
}
