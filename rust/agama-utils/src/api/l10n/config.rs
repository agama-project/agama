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

/// Localization config.
#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq, Merge, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    /// Locale (e.g., "en_US.UTF-8").
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "language")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub locale: Option<String>,

    /// Keymap (e.g., "us", "cz(qwerty)", etc.).
    #[serde(skip_serializing_if = "Option::is_none")]
    #[serde(alias = "keyboard")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub keymap: Option<String>,

    /// Timezone (e.g., "Europe/Berlin").
    #[serde(skip_serializing_if = "Option::is_none")]
    #[merge(strategy = merge::option::overwrite_none)]
    pub timezone: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merge() {
        let default_config = Config::default();
        let mut config = Config {
            locale: Some("en_US.UTF-8".to_string()),
            keymap: Some("en".to_string()),
            timezone: Some("Europe/Berlin".to_string()),
        };
        let old_config = config.clone();

        // no changes
        config.merge(default_config);
        assert_eq!(config, old_config);

        // full replacement
        let mut new_config = Config {
            locale: Some("es_ES.UTF-8".to_string()),
            keymap: Some("es".to_string()),
            timezone: Some("Atlantic/Canary".to_string()),
        };

        new_config.merge(config.clone());
        assert_eq!(new_config.locale, Some("es_ES.UTF-8".to_string()));
        assert_eq!(new_config.keymap, Some("es".to_string()));
        assert_eq!(new_config.timezone, Some("Atlantic/Canary".to_string()));

        // partial update
        let mut new_config = Config {
            locale: Some("cs_CZ.UTF-8".to_string()),
            ..Default::default()
        };

        new_config.merge(config);
        assert_eq!(new_config.locale, Some("cs_CZ.UTF-8".to_string()));
        assert_eq!(new_config.keymap, Some("en".to_string()));
        assert_eq!(new_config.timezone, Some("Europe/Berlin".to_string()));
    }
}
