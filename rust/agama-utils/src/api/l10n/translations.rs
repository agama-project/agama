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

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a set of translations for a given entry.
#[derive(Clone, Default, Debug, Deserialize, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Translations {
    /// Translated descriptions, by locale.
    #[serde(default)]
    pub description: HashMap<String, String>,
    /// Translated mode names and descriptions, by locale.
    /// mode_id -> "name"/"description" -> locale -> translated text
    #[serde(default)]
    pub mode: HashMap<String, HashMap<String, HashMap<String, String>>>,
}
