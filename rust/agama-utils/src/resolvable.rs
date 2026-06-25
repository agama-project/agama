// Copyright (c) [2026] SUSE LLC
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

use gettextrs::gettext;
use serde::Deserialize;
use std::fmt;

/// Represents a software resolvable.
#[derive(Clone, Debug, Deserialize, PartialEq)]
pub struct Resolvable {
    pub name: String,
    #[serde(rename = "type")]
    pub r#type: ResolvableType,
    #[serde(default)]
    pub optional: bool,
}

impl Resolvable {
    pub fn new(name: &str, r#type: ResolvableType) -> Self {
        Self {
            name: name.to_string(),
            r#type,
            optional: false,
        }
    }

    pub fn package(name: &str) -> Self {
        Self::new(name, ResolvableType::Package)
    }

    pub fn pattern(name: &str) -> Self {
        Self::new(name, ResolvableType::Pattern)
    }
}

/// Software resolvable type (package or pattern).
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ResolvableType {
    Package = 0,
    Pattern = 1,
    Product = 2,
}

impl fmt::Display for ResolvableType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let label = match self {
            ResolvableType::Package => gettext("package"),
            ResolvableType::Pattern => gettext("pattern"),
            ResolvableType::Product => gettext("product"),
        };
        write!(f, "{}", label)
    }
}
