use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct MiscApiDocBuilder;

impl ApiDocBuilder for MiscApiDocBuilder {
    fn title(&self) -> String {
        "Miscelaneous HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::web::http::__path_ping>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<crate::web::http::PingResponse>()
            .build()
    }
}
