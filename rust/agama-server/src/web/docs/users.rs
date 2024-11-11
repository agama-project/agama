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
