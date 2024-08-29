use utoipa::openapi::{ComponentsBuilder, OpenApi, OpenApiBuilder, PathsBuilder};

pub struct ManagerApiDocBuilder;

impl ManagerApiDocBuilder {
    pub fn build() -> OpenApi {
        let paths = PathsBuilder::new()
            .path_from::<crate::manager::web::__path_finish_action>()
            .path_from::<crate::manager::web::__path_install_action>()
            .path_from::<crate::manager::web::__path_installer_status>()
            .path_from::<crate::manager::web::__path_probe_action>()
            .build();

        let components = ComponentsBuilder::new()
            .schema_from::<agama_lib::manager::InstallationPhase>()
            .schema_from::<crate::manager::web::InstallerStatus>()
            .build();

        OpenApiBuilder::new()
            .paths(paths)
            .components(Some(components))
            .build()
    }
}
