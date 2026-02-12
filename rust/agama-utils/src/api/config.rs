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

use crate::api::{
    bootloader, files, hostname, iscsi, l10n, network, proxy, question, s390, security,
    software::{self, ProductConfig},
    storage, users,
};
use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_with::skip_serializing_none;

#[skip_serializing_none]
#[derive(Clone, Debug, Default, Deserialize, Serialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::recurse)]
pub struct Config {
    pub bootloader: Option<bootloader::Config>,
    pub hostname: Option<hostname::Config>,
    #[serde(alias = "localization")]
    pub l10n: Option<l10n::Config>,
    pub proxy: Option<proxy::Config>,
    #[serde(flatten)]
    pub security: Option<security::Config>,
    #[serde(flatten)]
    pub software: Option<software::Config>,
    pub network: Option<network::Config>,
    pub questions: Option<question::Config>,
    #[serde(flatten)]
    pub storage: Option<storage::Config>,
    pub iscsi: Option<iscsi::Config>,
    #[serde(flatten)]
    pub files: Option<files::Config>,
    #[serde(flatten)]
    pub users: Option<users::Config>,
    #[serde(flatten)]
    pub s390: Option<s390::Config>,
}

impl Config {
    pub fn with_product(product_id: String) -> Self {
        Self {
            software: Some(software::Config {
                product: Some(ProductConfig {
                    id: Some(product_id),
                    ..Default::default()
                }),
                ..Default::default()
            }),
            ..Default::default()
        }
    }
}
