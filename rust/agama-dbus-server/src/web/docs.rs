use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    info(description = "Agama web API description"),
    paths(super::http::ping),
    components(schemas(super::http::PingResponse))
)]
pub struct ApiDoc;
