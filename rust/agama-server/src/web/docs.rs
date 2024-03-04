use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(description = "Agama web API description"),
    paths(
        super::http::ping,
        crate::software::web::patterns,
        crate::l10n::web::get_config,
        crate::l10n::web::keymaps,
        crate::l10n::web::locales,
        crate::l10n::web::set_config,
        crate::l10n::web::timezones,
        crate::software::web::get_config,
        crate::software::web::set_config,
        crate::software::web::patterns,
    ),
    components(
        schemas(super::http::PingResponse),
        schemas(crate::l10n::LocaleEntry),
        schemas(crate::l10n::web::LocaleConfig),
        schemas(crate::l10n::Keymap),
        schemas(crate::l10n::TimezoneEntry),
        schemas(agama_lib::software::Pattern),
        schemas(agama_lib::product::Product),
        schemas(crate::software::web::PatternEntry)
    )
)]
pub struct ApiDoc;
