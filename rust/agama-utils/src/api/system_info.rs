// Copyright (c) [2025-2026] SUSE LLC
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

use crate::api::{hostname, l10n, manager, network, proxy, s390, software};
use serde::Serialize;
use serde_json::Value;
use serde_with::skip_serializing_none;

#[skip_serializing_none]
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    #[serde(flatten)]
    pub manager: manager::SystemInfo,
    pub hostname: hostname::SystemInfo,
    pub proxy: Option<proxy::Config>,
    pub l10n: l10n::SystemInfo,
    pub software: software::SystemInfo,
    pub storage: Option<Value>,
    pub iscsi: Option<Value>,
    pub network: network::SystemInfo,
    pub s390: Option<s390::SystemInfo>,
}
