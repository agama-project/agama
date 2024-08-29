use utoipa::openapi::{ComponentsBuilder, OpenApi, OpenApiBuilder, PathsBuilder};

pub struct L10nApiDocBuilder;

impl L10nApiDocBuilder {
    pub fn build() -> OpenApi {
        let paths = PathsBuilder::new()
            .path_from::<crate::l10n::web::__path_get_config>()
            .path_from::<crate::l10n::web::__path_keymaps>()
            .path_from::<crate::l10n::web::__path_locales>()
            .path_from::<crate::l10n::web::__path_set_config>()
            .path_from::<crate::l10n::web::__path_timezones>()
            .build();

        let components = ComponentsBuilder::new()
            .schema_from::<agama_lib::localization::model::LocaleConfig>()
            .schema_from::<agama_locale_data::KeymapId>()
            .schema_from::<agama_locale_data::LocaleId>()
            .schema_from::<crate::l10n::Keymap>()
            .schema_from::<crate::l10n::LocaleEntry>()
            .schema_from::<crate::l10n::TimezoneEntry>()
            .build();

        OpenApiBuilder::new()
            .paths(paths)
            .components(Some(components))
            .build()
    }
}
