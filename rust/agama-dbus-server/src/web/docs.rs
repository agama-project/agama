use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(description = "Agama web API description"),
    paths(super::http::ping, crate::l10n::web::locales),
    components(
        schemas(super::http::PingResponse),
        schemas(crate::l10n::web::LocalesResponse),
        schemas(crate::l10n::LocaleEntry)
    )
)]
pub struct ApiDoc;
