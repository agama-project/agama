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

use agama_locale_data::{KeymapId, LocaleId, TimezoneId};
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, DisplayFromStr};

/// Describes what Agama proposes for the target system.
#[serde_as]
#[derive(Clone, Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct Proposal {
    /// Keymap (e.g., "us", "cz(qwerty)", etc.).
    #[serde_as(as = "DisplayFromStr")]
    pub keymap: KeymapId,
    /// Locale (e.g., "en_US.UTF-8").
    #[serde_as(as = "DisplayFromStr")]
    pub locale: LocaleId,
    /// Timezone (e.g., "Europe/Berlin").
    #[serde_as(as = "DisplayFromStr")]
    pub timezone: TimezoneId,
}
