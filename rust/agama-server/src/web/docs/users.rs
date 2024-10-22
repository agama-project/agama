use utoipa::openapi::{ComponentsBuilder, Paths, PathsBuilder};

use super::ApiDocBuilder;

pub struct UsersApiDocBuilder;

impl ApiDocBuilder for UsersApiDocBuilder {
    fn title(&self) -> String {
        "Users HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        PathsBuilder::new()
            .path_from::<crate::users::web::__path_get_root_config>()
            .path_from::<crate::users::web::__path_get_user_config>()
            .path_from::<crate::users::web::__path_patch_root>()
            .path_from::<crate::users::web::__path_remove_first_user>()
            .path_from::<crate::users::web::__path_set_first_user>()
            .build()
    }

    fn components(&self) -> utoipa::openapi::Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::users::FirstUser>()
            .schema_from::<agama_lib::users::model::RootConfig>()
            .schema_from::<agama_lib::users::model::RootPatchSettings>()
            .schema(
                "zbus.zvariant.OwnedValue",
                utoipa::openapi::ObjectBuilder::new()
                    .description(Some("Additional user information (unused)".to_string()))
                    .build(),
            )
            .build()
    }
}
