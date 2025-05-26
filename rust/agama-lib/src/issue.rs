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

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct Issue {
    description: String,
    details: Option<String>,
    source: u32,
    severity: u32,
    kind: String,
}

impl Issue {
    pub fn from_tuple(
        (description, kind, details, source, severity): (String, String, String, u32, u32),
    ) -> Self {
        let details = if details.is_empty() {
            None
        } else {
            Some(details)
        };

        Self {
            description,
            kind,
            details,
            source,
            severity,
        }
    }
}

impl TryFrom<&zbus::zvariant::Value<'_>> for Issue {
    type Error = zbus::zvariant::Error;

    fn try_from(value: &zbus::zvariant::Value<'_>) -> Result<Self, Self::Error> {
        let value = value.downcast_ref::<zbus::zvariant::Structure>()?;
        let fields = value.fields();

        let Some([description, kind, details, source, severity]) = fields.get(0..5) else {
            return Err(zbus::zvariant::Error::Message(
                "Not enough elements for building an Issue.".to_string(),
            ));
        };

        let description: String = description.try_into()?;
        let kind: String = kind.try_into()?;
        let details: String = details.try_into()?;
        let source: u32 = source.try_into()?;
        let severity: u32 = severity.try_into()?;

        Ok(Issue {
            description,
            kind,
            details: if details.is_empty() {
                None
            } else {
                Some(details.to_string())
            },
            severity,
            source,
        })
    }
}
