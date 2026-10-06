// Copyright (c) [2024-2025] SUSE LLC
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

//! Implements support for reading software licenses.

use std::fmt::Display;

use agama_locale_data::LocaleId;
use regex::Regex;
use schemars::JsonSchema;
use serde::Serialize;
use serde_with::{serde_as, DisplayFromStr};
use thiserror::Error;

/// Represents a product license.
///
/// It contains the license ID and name, in the current system language.
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct License {
    /// License ID.
    pub id: String,
    /// License name.
    pub name: String,
}

/// Represents a license content.
///
/// It contains the license ID, name and body. The name is extracted from the first paragraph of
/// the license text; the body is the rest of it.
#[serde_as]
#[derive(Clone, Debug, Serialize, JsonSchema)]
pub struct LicenseContent {
    /// License ID.
    pub id: String,
    /// License name.
    pub name: String,
    /// License text.
    pub body: String,
    /// License language.
    #[serde_as(as = "DisplayFromStr")]
    #[schemars(with = "String")]
    pub language: LanguageTag,
}

/// Simplified representation of the RFC 5646 language code.
///
/// It only considers xx and xx-XX formats.
#[derive(Clone, Debug, Serialize, PartialEq, JsonSchema)]
pub struct LanguageTag {
    // ISO-639
    pub language: String,
    // ISO-3166
    pub territory: Option<String>,
}

impl Default for LanguageTag {
    fn default() -> Self {
        LanguageTag {
            language: "en".to_string(),
            territory: None,
        }
    }
}

impl Display for LanguageTag {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(territory) = &self.territory {
            write!(f, "{}-{}", self.language, territory)
        } else {
            write!(f, "{}", self.language)
        }
    }
}

impl From<&LocaleId> for LanguageTag {
    fn from(locale: &LocaleId) -> Self {
        LanguageTag {
            language: locale.language.clone(),
            territory: Some(locale.territory.clone()),
        }
    }
}

#[derive(Error, Debug)]
#[error("Not a valid language code: {0}")]
pub struct InvalidLanguageCode(String);

impl TryFrom<&str> for LanguageTag {
    type Error = InvalidLanguageCode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let language_regexp: Regex = Regex::new(r"^([[:alpha:]]+)(?:[_-]([A-Z]+))?").unwrap();

        let captures = language_regexp
            .captures(value)
            .ok_or_else(|| InvalidLanguageCode(value.to_string()))?;

        Ok(Self {
            language: captures.get(1).unwrap().as_str().to_string(),
            territory: captures.get(2).map(|e| e.as_str().to_string()),
        })
    }
}
