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

use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct L10nApiDocBuilder;

impl ApiDocBuilder for L10nApiDocBuilder {
    fn title(&self) -> String {
        "Localization HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::l10n::web::__path_get_config>()
            .path_from::<crate::l10n::web::__path_keymaps>()
            .path_from::<crate::l10n::web::__path_locales>()
            .path_from::<crate::l10n::web::__path_set_config>()
            .path_from::<crate::l10n::web::__path_timezones>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::localization::model::LocaleConfig>()
            .schema_from::<agama_locale_data::KeymapId>()
            .schema_from::<agama_locale_data::LocaleId>()
            .schema_from::<crate::l10n::Keymap>()
            .schema_from::<crate::l10n::LocaleEntry>()
            .schema_from::<crate::l10n::TimezoneEntry>()
            .build()
    }
}
