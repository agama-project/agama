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

pub type IssueMap = HashMap<Scope, Vec<Issue>>;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("D-Bus conversion error")]
    DBus(#[from] zbus::zvariant::Error),
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
    pub kind: String,
}

impl Issue {
    /// Creates a new issue.
    pub fn new(kind: &str, description: &str, severity: IssueSeverity) -> Self {
        Self {
            description: description.to_string(),
            kind: kind.to_string(),
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

impl TryFrom<&zbus::zvariant::Value<'_>> for Issue {
    type Error = Error;

    fn try_from(value: &zbus::zvariant::Value<'_>) -> Result<Self, Self::Error> {
        let value = value.downcast_ref::<zbus::zvariant::Structure>()?;
        let fields = value.fields();

        let Some([description, kind, details, source, severity]) = fields.get(0..5) else {
            return Err(zbus::zvariant::Error::Message(
                "Not enough elements for building an Issue.".to_string(),
            ))?;
        };

        let description: String = description.try_into()?;
        let kind: String = kind.try_into()?;
        let details: String = details.try_into()?;
        let source: u32 = source.try_into()?;
        let source = source as u8;
        let source = IssueSource::from_repr(source).ok_or(Error::UnknownSource(source))?;

        let severity: u32 = severity.try_into()?;
        let severity = severity as u8;
        let severity =
            IssueSeverity::from_repr(severity).ok_or(Error::UnknownSeverity(severity))?;

        Ok(Issue {
            description,
            kind,
            details: if details.is_empty() {
                None
            } else {
                Some(details.to_string())
            },
            source,
            severity,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zbus::zvariant;
    use zvariant::{Structure, Value};

    #[test]
    fn test_issue_from_dbus() {
        let dbus_issue = Structure::from((
            "Product not selected",
            "missing_product",
            "A product is required.",
            1 as u32,
            0 as u32,
        ));

        let issue = Issue::try_from(&Value::Structure(dbus_issue)).unwrap();
        assert_eq!(&issue.description, "Product not selected");
        assert_eq!(&issue.kind, "missing_product");
        assert_eq!(issue.details, Some("A product is required.".to_string()));
        assert_eq!(issue.source, IssueSource::System);
        assert_eq!(issue.severity, IssueSeverity::Warn);
    }

    #[test]
    fn test_unknown_issue_source() {
        let dbus_issue = Structure::from((
            "Product not selected",
            "missing_product",
            "A product is required.",
            5 as u32,
            0 as u32,
        ));

        let issue = Issue::try_from(&Value::Structure(dbus_issue));
        assert!(matches!(issue, Err(Error::UnknownSource(5))));
    }

    #[test]
    fn test_unknown_issue_severity() {
        let dbus_issue = Structure::from((
            "Product not selected",
            "missing_product",
            "A product is required.",
            0 as u32,
            5 as u32,
        ));

        let issue = Issue::try_from(&Value::Structure(dbus_issue));
        assert!(matches!(issue, Err(Error::UnknownSeverity(5))));
    }
}
