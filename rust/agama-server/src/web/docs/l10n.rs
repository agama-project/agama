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
