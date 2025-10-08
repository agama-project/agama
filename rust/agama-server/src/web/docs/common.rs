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

//! This module implements builders for the generation of OpenAPI documentation for the common APIs
//! (e.g., issues, service status or progress).

use super::ApiDocBuilder;
use crate::web::common::ServiceStatus;
use agama_lib::progress::Progress;
use utoipa::openapi::{
    path::OperationBuilder, schema::RefBuilder, Components, ComponentsBuilder, ContentBuilder,
    HttpMethod, PathItem, Paths, PathsBuilder, ResponseBuilder, ResponsesBuilder,
};

/// Implements a builder for the service status API documentation.
pub struct ServiceStatusApiDocBuilder {
    path: String,
}

impl ServiceStatusApiDocBuilder {
    /// Creates a new builder.
    ///
    /// * `path`: path of the API (e.g., "/api/storage/status").
    pub fn new(path: &str) -> Self {
        Self {
            path: path.to_string(),
        }
    }
}

impl ApiDocBuilder for ServiceStatusApiDocBuilder {
    fn title(&self) -> String {
        "Services status HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        let path_item = PathItem::new(
            HttpMethod::Get,
            OperationBuilder::new()
                .summary(Some("Service status".to_string()))
                .operation_id(Some("status"))
                .responses(
                    ResponsesBuilder::new().response(
                        "200",
                        ResponseBuilder::new()
                            .description("Current service status")
                            .content(
                                "application/json",
                                ContentBuilder::new()
                                    .schema(Some(RefBuilder::new().ref_location(
                                        "#/components/schemas/ServiceStatus".to_string(),
                                    )))
                                    .build(),
                            ),
                    ),
                ),
        );

        PathsBuilder::new()
            .path(self.path.to_string(), path_item)
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new()
            .schema_from::<ServiceStatus>()
            .build()
    }
}

/// Implements a builder for the progress API documentation.
pub struct ProgressApiDocBuilder {
    path: String,
}

impl ProgressApiDocBuilder {
    /// Creates a new builder.
    ///
    /// * `path`: path of the API (e.g., "/api/storage/progress").
    pub fn new(path: &str) -> Self {
        Self {
            path: path.to_string(),
        }
    }
}

impl ApiDocBuilder for ProgressApiDocBuilder {
    fn title(&self) -> String {
        "Progress HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        let path_item =
            PathItem::new(
                HttpMethod::Get,
                OperationBuilder::new()
                    .summary(Some("Service progress".to_string()))
                    .operation_id(Some("progress"))
                    .responses(
                        ResponsesBuilder::new().response(
                            "200",
                            ResponseBuilder::new()
                                .description("Current operation progress")
                                .content(
                                    "application/json",
                                    ContentBuilder::new()
                                        .schema(Some(RefBuilder::new().ref_location(
                                            "#/components/schemas/Progress".to_string(),
                                        )))
                                        .build(),
                                ),
                        ),
                    ),
            );

        PathsBuilder::new()
            .path(self.path.to_string(), path_item)
            .build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new().schema_from::<Progress>().build()
    }
}
