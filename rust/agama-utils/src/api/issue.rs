// Copyright (c) [2025] SUSE LLC
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

use crate::api::scope::Scope;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use strum::FromRepr;

#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IssueWithScope {
    pub scope: Scope,
    #[serde(flatten)]
    pub issue: Issue,
}

pub type IssueMap = HashMap<Scope, Vec<Issue>>;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Unknown issue source: {0}")]
    UnknownSource(u8),
    #[error("Unknown issue severity: {0}")]
    UnknownSeverity(u8),
}

// NOTE: in order to compare two issues, it should be enough to compare the description
// and the details.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, Eq, Hash, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub description: String,
    pub details: Option<String>,
    pub source: IssueSource,
    pub severity: IssueSeverity,
    pub class: String,
}

impl Issue {
    /// Creates a new issue.
    pub fn new(class: &str, description: &str, severity: IssueSeverity) -> Self {
        Self {
            description: description.to_string(),
            class: class.to_string(),
            source: IssueSource::Config,
            severity,
            details: None,
        }
    }

    /// Sets the details for the issue.
    pub fn with_details(mut self, details: &str) -> Self {
        self.details = Some(details.to_string());
        self
    }

    /// Sets the source for the issue.
    pub fn with_source(mut self, source: IssueSource) -> Self {
        self.source = source;
        self
    }
}

#[derive(
    Clone, Copy, Debug, Deserialize, Serialize, FromRepr, PartialEq, Eq, Hash, utoipa::ToSchema,
)]
#[repr(u8)]
#[serde(rename_all = "camelCase")]
pub enum IssueSource {
    Unknown = 0,
    System = 1,
    Config = 2,
}

#[derive(
    Clone, Copy, Debug, Deserialize, Serialize, FromRepr, PartialEq, Eq, Hash, utoipa::ToSchema,
)]
#[repr(u8)]
#[serde(rename_all = "camelCase")]
pub enum IssueSeverity {
    Warn = 0,
    Error = 1,
}
