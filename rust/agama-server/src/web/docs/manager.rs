use utoipa::openapi::{ComponentsBuilder, PathsBuilder};

use super::ApiDocBuilder;

pub struct ManagerApiDocBuilder;

impl ApiDocBuilder for ManagerApiDocBuilder {
    fn title(&self) -> String {
        "Manager HTTP API".to_string()
    }

    fn paths(&self) -> utoipa::openapi::Paths {
        PathsBuilder::new()
            .path_from::<crate::manager::web::__path_finish_action>()
            .path_from::<crate::manager::web::__path_install_action>()
            .path_from::<crate::manager::web::__path_installer_status>()
            .path_from::<crate::manager::web::__path_probe_action>()
            .build()
    }

    fn components(&self) -> utoipa::openapi::Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::manager::InstallationPhase>()
            .schema_from::<agama_lib::manager::InstallerStatus>()
            .build()
    }
}
