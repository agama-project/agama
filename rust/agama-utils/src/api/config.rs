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
    bootloader, files, hostname, iscsi, l10n, network, proxy, question, security,
    software::{self, ProductConfig},
    storage, users,
};
use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub proxy: Option<proxy::Config>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub security: Option<security::Config>,
    #[serde(flatten, skip_serializing_if = "Option::is_none")]
    pub software: Option<software::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<network::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub questions: Option<question::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(flatten)]
    pub storage: Option<storage::Config>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iscsi: Option<iscsi::Config>,
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

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, utoipa::ToSchema)]
#[serde(transparent)]
pub struct RawConfig(pub Value);

impl Merge for RawConfig {
    // Merge by using "ignore" strategy, that is, lhs takes precedence over rhs.
    // Note that the new config is used as lhs, for example: new_config.merge(old_config). This
    // implies we want to keep the current values of lhs and only the missing values are taken from
    // rhs.
    fn merge(&mut self, rhs: Self) {
        let lhs_value = &mut self.0;
        let rhs_value = rhs.0;

        let Value::Object(lhs_object) = lhs_value else {
            return;
        };

        let Value::Object(rhs_object) = rhs_value else {
            return;
        };

        for (k, v) in rhs_object {
            lhs_object.entry(k).or_insert(v);
        }
    }
}

#[cfg(test)]
mod tests_raw_config {
    use super::*;

    #[test]
    fn test_merge_from_empty() {
        let original: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value",
                "field2": [
                    { "foo": "bar" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: RawConfig = serde_json::from_str(r#"{}"#).unwrap();

        config.merge(original.clone());
        assert_eq!(config, original);
    }

    #[test]
    fn test_merge_value() {
        let original: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value",
                "field2": [
                    { "foo1": "bar1" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: RawConfig = serde_json::from_str(
            r#"
            {
                "field2": [
                    { "foo2": "bar2" }
                 ]
            }
            "#,
        )
        .unwrap();

        let result: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value",
                "field2": [
                    { "foo2": "bar2" }
                 ]
            }
            "#,
        )
        .unwrap();

        config.merge(original);
        assert_eq!(config, result);
    }

    #[test]
    fn test_merge_list() {
        let original: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value1",
                "field2": [
                    { "foo1": "bar1" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value2",
            }
            "#,
        )
        .unwrap();

        let result: RawConfig = serde_json::from_str(
            r#"
            {
                "field1": "value2",
                "field2": [
                    { "foo1": "bar1" }
                 ]
            }
            "#,
        )
        .unwrap();

        config.merge(original);
        assert_eq!(config, result);
    }
}
