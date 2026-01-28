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

use merge::Merge;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Eq, utoipa::ToSchema)]
#[serde(transparent)]
pub struct Config(pub Value);

impl Merge for Config {
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
mod tests {
    use super::*;

    #[test]
    fn test_merge_from_empty() {
        let original: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini.test",
                "targets": [
                    { "name": "target.test" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: Config = serde_json::from_str(r#"{}"#).unwrap();

        config.merge(original.clone());
        assert_eq!(config, original);
    }

    #[test]
    fn test_merge_initiator() {
        let original: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini.test",
                "targets": [
                    { "name": "target1.test" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: Config = serde_json::from_str(
            r#"
            {
                "targets": [
                    { "name": "target2.test" }
                 ]
            }
            "#,
        )
        .unwrap();

        let result: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini.test",
                "targets": [
                    { "name": "target2.test" }
                ]
            }
            "#,
        )
        .unwrap();

        config.merge(original);
        assert_eq!(config, result);
    }

    #[test]
    fn test_merge_targets() {
        let original: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini1.test",
                "targets": [
                    { "name": "target1.test" }
                 ]
            }
            "#,
        )
        .unwrap();

        let mut config: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini2.test"
            }
            "#,
        )
        .unwrap();

        let result: Config = serde_json::from_str(
            r#"
            {
                "initiator": "ini2.test",
                "targets": [
                    { "name": "target1.test" }
                ]
            }
            "#,
        )
        .unwrap();

        config.merge(original);
        assert_eq!(config, result);
    }
}
