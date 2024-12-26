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

use utoipa::openapi::{Components, ComponentsBuilder, OpenApi, Paths, PathsBuilder};

use super::{
    common::{IssuesApiDocBuilder, ServiceStatusApiDocBuilder},
    ApiDocBuilder,
};

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
            .path_from::<crate::software::web::__path_set_resolvables>()
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<agama_lib::product::Product>()
            .schema_from::<agama_lib::product::RegistrationRequirement>()
            .schema_from::<agama_lib::software::Pattern>()
            .schema_from::<agama_lib::software::model::RegistrationInfo>()
            .schema_from::<agama_lib::software::model::RegistrationParams>()
            .schema_from::<agama_lib::software::model::ResolvableParams>()
            .schema_from::<agama_lib::software::model::ResolvableType>()
            .schema_from::<agama_lib::software::SelectedBy>()
            .schema_from::<agama_lib::software::model::SoftwareConfig>()
            .schema_from::<crate::software::web::SoftwareProposal>()
            .schema_from::<crate::web::common::Issue>()
            .build()
    }

    fn nested(&self) -> Option<OpenApi> {
        let mut issues = IssuesApiDocBuilder::new()
            .add(
                "/api/software/issues/software",
                "List of software-related issues",
                "software_issues",
            )
            .add(
                "/api/product/issues/product",
                "List of product-related issues",
                "product_issues",
            )
            .build();
        let status = ServiceStatusApiDocBuilder::new("/api/storage/status").build();
        issues.merge(status);
        Some(issues)
    }
}
