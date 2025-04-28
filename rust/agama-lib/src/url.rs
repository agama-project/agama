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

/// Represents a URL for scripts and files.
///
/// It extends the original [url::Url] struct with support for relative URLs
/// (`relurl:///` in YaST).
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq, utoipa::ToSchema)]
#[serde(untagged)]
pub enum Url {
    Absolute(url::Url),
    Relative(String),
}

#[derive(Debug, thiserror::Error)]
pub enum UrlError {
    #[error("Error parsing URL: {0} ({1})")]
    ParseError(String, url::ParseError),
    #[error("Cannot resolve an absolute URL")]
    CannotResolveAbsoluteUrl(url::Url),
    #[error("Cannot join URL")]
    CannotJoin(url::ParseError),
}

impl Url {
    /// Parses a string representing a URL into a Url enum.
    pub fn parse(url: &str) -> Result<Self, UrlError> {
        match url::Url::parse(url) {
            Ok(url) => Ok(Url::Absolute(url)),
            Err(url::ParseError::RelativeUrlWithoutBase) => Ok(Url::Relative(url.to_string())),
            Err(err) => Err(UrlError::ParseError(url.to_string(), err)),
        }
    }

    pub fn to_string(&self) -> String {
        match self {
            Url::Absolute(url) => url.to_string(),
            Url::Relative(url) => url.to_string(),
        }
    }

    pub fn join(&self, input: &str) -> Result<Self, UrlError> {
        match self {
            Url::Absolute(url) => {
                let joined = url.join(input).map_err(|e| UrlError::CannotJoin(e))?;
                Ok(Url::Absolute(joined))
            }
            Url::Relative(url) => {
                let joined = format!("{url}/{input}");
                Ok(Url::Relative(joined))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_absolute_url() {
        let url = Url::parse("https://example.com").unwrap();
        assert!(matches!(url, Url::Absolute(_)));
    }

    #[test]
    fn test_parse_relative_url() {
        let url = Url::parse("/path/to/profile").unwrap();
        assert!(matches!(url, Url::Relative(_)));
    }

    #[test]
    fn test_parse_invalid_url() {
        let result = Url::parse("http:///");
        dbg!(&result);
        assert!(result.is_err());
    }

    #[test]
    fn test_join_absolute_url() {
        let url = Url::parse("https://example.com").unwrap();
        let joined = url.join("test").unwrap();
        assert_eq!(&joined.to_string(), "https://example.com/test");

        let joined = url.join("https://override.lan/").unwrap();
        assert_eq!(&joined.to_string(), "https://override.lan/");
    }

    #[test]
    fn test_join_relative_url() {
        let url = Url::parse("/path/to").unwrap();
        let joined = url.join("profile").unwrap();
        assert_eq!(&joined.to_string(), "/path/to/profile");
    }
}
