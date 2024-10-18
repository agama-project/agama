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

use serde::{Deserialize, Serialize};

use super::{Script, ScriptSource};

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptsConfig {
    /// User-defined pre-installation scripts
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub pre: Vec<ScriptConfig>,
    /// User-defined post-installation scripts
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub post: Vec<ScriptConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptConfig {
    /// Script's name.
    pub name: String,
    /// Script's source
    #[serde(flatten)]
    pub source: ScriptSource,
}

impl From<&Script> for ScriptConfig {
    fn from(value: &Script) -> Self {
        ScriptConfig {
            name: value.name.clone(),
            source: value.source.clone(),
        }
    }
}
