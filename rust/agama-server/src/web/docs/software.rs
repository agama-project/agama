use utoipa::openapi::{ComponentsBuilder, OpenApi, OpenApiBuilder, PathsBuilder};

pub struct SoftwareApiDocBuilder;

impl SoftwareApiDocBuilder {
    pub fn build() -> OpenApi {
        let paths = PathsBuilder::new()
            .path_from::<crate::software::web::__path_get_config>()
            .path_from::<crate::software::web::__path_patterns>()
            .path_from::<crate::software::web::__path_probe>()
            .path_from::<crate::software::web::__path_products>()
            .path_from::<crate::software::web::__path_proposal>()
            .path_from::<crate::software::web::__path_set_config>()
            .build();

        let components = ComponentsBuilder::new()
            .schema_from::<agama_lib::product::Product>()
            .schema_from::<agama_lib::product::RegistrationRequirement>()
            .schema_from::<agama_lib::software::Pattern>()
            .schema_from::<agama_lib::software::model::RegistrationInfo>()
            .schema_from::<agama_lib::software::model::RegistrationParams>()
            .schema_from::<agama_lib::software::SelectedBy>()
            .schema_from::<agama_lib::software::model::SoftwareConfig>()
            .schema_from::<crate::software::web::SoftwareProposal>()
            .build();

        OpenApiBuilder::new()
            .paths(paths)
            .components(Some(components))
            .build()
    }
}
