// Copyright (c) [2024] SUSE LLC
//
// All Rights Reserved.
//
// This program is free software; you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation; either version 2 of the License, or (at your option)
// any later version.
//
// This program is distributed in the hope that it will be useful, but WITHOUT
// ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
// FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
// more details.
//
// You should have received a copy of the GNU General Public License along
// with this program; if not, contact SUSE LLC.
//
// To contact SUSE LLC about this file by physical or electronic mail, you may
// find current contact information at www.suse.com.

use utoipa::openapi::{ComponentsBuilder, OpenApi, PathsBuilder};

use super::{
    common::{ProgressApiDocBuilder, ServiceStatusApiDocBuilder},
    ApiDocBuilder,
};

pub struct ManagerApiDocBuilder;

impl ApiDocBuilder for ManagerApiDocBuilder {
    fn title(&self) -> String {
        "Manager HTTP API".to_string()
    }

    fn paths(&self) -> utoipa::openapi::Paths {
        PathsBuilder::new()
            .path_from::<crate::manager::web::__path_download_logs>()
            .path_from::<crate::manager::web::__path_finish_action>()
            .path_from::<crate::manager::web::__path_install_action>()
            .path_from::<crate::manager::web::__path_installer_status>()
            .path_from::<crate::manager::web::__path_list_logs>()
            .path_from::<crate::manager::web::__path_probe_action>()
            .build()
    }

    fn components(&self) -> utoipa::openapi::Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::manager::InstallationPhase>()
            .schema_from::<agama_lib::manager::InstallerStatus>()
            .schema_from::<agama_lib::logs::LogsLists>()
            .build()
    }

    fn nested(&self) -> Option<OpenApi> {
        let mut status = ServiceStatusApiDocBuilder::new("/api/storage/status").build();
        let progress = ProgressApiDocBuilder::new("/api/storage/progress").build();
        status.merge(progress);
        Some(status)
    }
}
