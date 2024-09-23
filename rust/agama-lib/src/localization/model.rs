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

#[derive(Clone, Debug, Default, Serialize, Deserialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct LocaleConfig {
    /// Locales to install in the target system
    pub locales: Option<Vec<String>>,
    /// Keymap for the target system
    pub keymap: Option<String>,
    /// Timezone for the target system
    pub timezone: Option<String>,
    /// User-interface locale. It is actually not related to the `locales` property.
    pub ui_locale: Option<String>,
    /// User-interface locale. It is relevant only on local installations.
    pub ui_keymap: Option<String>,
}
