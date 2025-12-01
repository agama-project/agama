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

use std::{fmt::Display, str::FromStr};

use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_with::{serde_as, DisplayFromStr};
use thiserror::Error;

/// Represents a product license.
///
/// It contains the license ID and the list of languages that with a translation.
#[serde_as]
#[derive(Clone, Debug, Deserialize, Serialize, utoipa::ToSchema)]
pub struct License {
    /// License ID.
    pub id: String,
    /// Languages in which the license is translated.
    #[serde_as(as = "Vec<DisplayFromStr>")]
    pub languages: Vec<LanguageTag>,
}

/// Represents a license content.
///
/// It contains the license ID and the body.
///
/// TODO: in the future it might contain a title, extracted from the text.
#[serde_as]
#[derive(Clone, Debug, Serialize, utoipa::ToSchema)]
pub struct LicenseContent {
    /// License ID.
    pub id: String,
    /// License text.
    pub body: String,
    /// License language.
    #[serde_as(as = "DisplayFromStr")]
    pub language: LanguageTag,
}

/// Simplified representation of the RFC 5646 language code.
///
/// It only considers xx and xx-XX formats.
#[derive(Clone, Debug, Serialize, PartialEq, utoipa::ToSchema)]
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
            write!(f, "{}-{}", &self.language, territory)
        } else {
            write!(f, "{}", &self.language)
        }
    }
}

// Required by serde_as. Perhaps we should replace the implementation of try_from
// with this one.
impl FromStr for LanguageTag {
    type Err = InvalidLanguageCode;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        LanguageTag::try_from(s)
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
