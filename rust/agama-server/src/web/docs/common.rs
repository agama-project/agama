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
use crate::web::common::{Issue, ServiceStatus};
use agama_lib::progress::Progress;
use utoipa::openapi::{
    path::OperationBuilder, schema::RefBuilder, ArrayBuilder, Components, ComponentsBuilder,
    ContentBuilder, HttpMethod, PathItem, Paths, PathsBuilder, ResponseBuilder, ResponsesBuilder,
};

/// Implements a builder for the issues API documentation.
pub struct IssuesApiDocBuilder {
    paths: Vec<(String, PathItem)>,
}

impl IssuesApiDocBuilder {
    pub fn new() -> Self {
        Self { paths: vec![] }
    }

    /// Adds a new issues API path.
    ///
    /// * `path`: path of the API.
    /// * `summary`: summary to be included in the OpenAPI documentation.
    /// * `operation_id`: operation ID of the API.
    pub fn add(self, path: &str, summary: &str, operation_id: &str) -> Self {
        let mut paths = self.paths;
        paths.push((path.to_string(), Self::issues_path(summary, operation_id)));
        Self { paths, ..self }
    }

    fn issues_path(summary: &'_ str, operation_id: &'_ str) -> PathItem {
        PathItem::new(
            HttpMethod::Get,
            OperationBuilder::new()
                .summary(Some(summary))
                .operation_id(Some(operation_id))
                .responses(
                    ResponsesBuilder::new().response(
                        "200",
                        ResponseBuilder::new()
                            .description("List of found issues")
                            .content(
                                "application/json",
                                ContentBuilder::new()
                                    .schema(Some(
                                        ArrayBuilder::new().items(RefBuilder::new().ref_location(
                                            "#/components/schemas/Issue".to_string(),
                                        )),
                                    ))
                                    .build(),
                            ),
                    ),
                ),
        )
    }
}

impl ApiDocBuilder for IssuesApiDocBuilder {
    fn title(&self) -> String {
        "Issues HTTP API".to_string()
    }

    fn paths(&self) -> Paths {
        let mut paths_builder = PathsBuilder::new();
        for (path, item) in self.paths.iter() {
            paths_builder = paths_builder.path(path, item.clone());
        }
        paths_builder.build()
    }

    fn components(&self) -> Components {
        ComponentsBuilder::new().schema_from::<Issue>().build()
    }
}

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
