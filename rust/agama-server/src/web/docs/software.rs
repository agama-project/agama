use utoipa::openapi::{Components, ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct SoftwareApiDocBuilder;

impl ApiDocBuilder for SoftwareApiDocBuilder {
    fn title(&self) -> String {
        "Software HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::software::web::__path_get_config>()
            .path_from::<crate::software::web::__path_patterns>()
            .path_from::<crate::software::web::__path_probe>()
            .path_from::<crate::software::web::__path_products>()
            .path_from::<crate::software::web::__path_proposal>()
            .path_from::<crate::software::web::__path_set_config>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::product::Product>()
            .schema_from::<agama_lib::product::RegistrationRequirement>()
            .schema_from::<agama_lib::software::Pattern>()
            .schema_from::<agama_lib::software::model::RegistrationInfo>()
            .schema_from::<agama_lib::software::model::RegistrationParams>()
            .schema_from::<agama_lib::software::SelectedBy>()
            .schema_from::<agama_lib::software::model::SoftwareConfig>()
            .schema_from::<crate::software::web::SoftwareProposal>()
            .build()
    }
}
