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

use crate::api::{
    bootloader, files, hostname, l10n, network, question,
    software::{self, ProductConfig},
    storage, users,
};
use merge::Merge;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Deserialize, Serialize, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
#[merge(strategy = merge::option::recurse)]
pub struct Config {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bootloader: Option<bootloader::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<hostname::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "localization")]
    pub l10n: Option<l10n::Config>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub software: Option<software::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<network::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<question::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(flatten)]
    pub storage: Option<storage::Config>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub files: Option<files::Config>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub users: Option<users::Config>,
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
