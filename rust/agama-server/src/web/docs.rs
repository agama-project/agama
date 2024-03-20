use utoipa::OpenApi;
#[derive(OpenApi)]
#[openapi(
    info(description = "Agama web API description"),
    paths(
        crate::l10n::web::get_config,
        crate::l10n::web::keymaps,
        crate::l10n::web::locales,
        crate::l10n::web::set_config,
        crate::l10n::web::timezones,
        crate::software::web::get_config,
        crate::software::web::patterns,
        crate::software::web::patterns,
        crate::software::web::set_config,
        crate::manager::web::probe_action,
        crate::manager::web::install_action,
        crate::manager::web::finish_action,
        crate::manager::web::installer_status,
        super::http::ping,
    ),
    components(
        schemas(agama_lib::product::Product),
        schemas(agama_lib::software::Pattern),
        schemas(agama_lib::manager::InstallationPhase),
        schemas(crate::l10n::Keymap),
        schemas(crate::l10n::LocaleEntry),
        schemas(crate::l10n::TimezoneEntry),
        schemas(crate::l10n::web::LocaleConfig),
        schemas(crate::software::web::SoftwareConfig),
        schemas(crate::software::web::SoftwareProposal),
        schemas(crate::manager::web::InstallerStatus),
        schemas(super::http::PingResponse),
    )
)]
pub struct ApiDoc;
