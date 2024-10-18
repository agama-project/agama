use utoipa::openapi::{ComponentsBuilder, OpenApi, OpenApiBuilder, PathsBuilder};

pub struct UsersApiDocBuilder;

impl UsersApiDocBuilder {
    pub fn build() -> OpenApi {
        let paths = PathsBuilder::new()
            .path_from::<crate::users::web::__path_get_root_config>()
            .path_from::<crate::users::web::__path_get_user_config>()
            .path_from::<crate::users::web::__path_patch_root>()
            .path_from::<crate::users::web::__path_remove_first_user>()
            .path_from::<crate::users::web::__path_set_first_user>()
            .build();

        let components = ComponentsBuilder::new()
            .schema_from::<agama_lib::users::FirstUser>()
            .schema_from::<agama_lib::users::model::RootConfig>()
            .schema_from::<agama_lib::users::model::RootPatchSettings>()
            .schema(
                "zbus.zvariant.OwnedValue",
                utoipa::openapi::ObjectBuilder::new()
                    .description(Some("Additional user information (unused)".to_string()))
                    .build(),
            )
            .build();

        OpenApiBuilder::new()
            .paths(paths)
            .components(Some(components))
            .build()
    }
}
