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

//! Defines useful types to deal with localization values

use regex::Regex;
use serde::Serialize;
use std::sync::OnceLock;
use std::{fmt::Display, str::FromStr};
use thiserror::Error;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct LocaleId {
    // ISO-639
    pub language: String,
    // ISO-3166
    pub territory: String,
    pub encoding: String,
}

impl Display for LocaleId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(
            f,
            "{}_{}.{}",
            &self.language, &self.territory, &self.encoding
        )
    }
}

impl Default for LocaleId {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            territory: "US".to_string(),
            encoding: "UTF-8".to_string(),
        }
    }
}

#[derive(Error, Debug)]
#[error("Not a valid locale string: {0}")]
pub struct InvalidLocaleCode(String);

impl TryFrom<&str> for LocaleId {
    type Error = InvalidLocaleCode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let locale_regexp: Regex =
            Regex::new(r"^([[:alpha:]]+)_([[:alpha:]]+)(?:\.(.+))?").unwrap();

        let captures = locale_regexp
            .captures(value)
            .ok_or_else(|| InvalidLocaleCode(value.to_string()))?;

        let encoding = captures
            .get(3)
            .map(|e| e.as_str())
            .unwrap_or("UTF-8")
            .to_string();

        Ok(Self {
            language: captures.get(1).unwrap().as_str().to_string(),
            territory: captures.get(2).unwrap().as_str().to_string(),
            encoding,
        })
    }
}

static KEYMAP_ID_REGEX: OnceLock<Regex> = OnceLock::new();

/// Keymap layout identifier
///
/// ```
/// use agama_locale_data::KeymapId;
/// use std::str::FromStr;
///
/// let id: KeymapId = "es(ast)".parse().unwrap();
/// assert_eq!(id.layout, "es");
/// assert_eq!(id.variant, Some("ast".to_string()));
/// assert_eq!(id.dashed(), "es-ast".to_string());
///
/// let id_with_dashes: KeymapId = "es-ast".parse().unwrap();
/// assert_eq!(id, id_with_dashes);
/// ```
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct KeymapId {
    pub layout: String,
    pub variant: Option<String>,
}

impl Default for KeymapId {
    fn default() -> Self {
        Self {
            layout: "us".to_string(),
            variant: None,
        }
    }
}

#[derive(Error, Debug, PartialEq)]
#[error("Invalid keymap ID: {0}")]
pub struct InvalidKeymap(String);

impl KeymapId {
    pub fn dashed(&self) -> String {
        if let Some(variant) = &self.variant {
            format!("{}-{}", &self.layout, variant)
        } else {
            self.layout.to_owned()
        }
    }
}

impl Display for KeymapId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        if let Some(variant) = &self.variant {
            write!(f, "{}({})", &self.layout, variant)
        } else {
            write!(f, "{}", &self.layout)
        }
    }
}

impl FromStr for KeymapId {
    type Err = InvalidKeymap;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let re = KEYMAP_ID_REGEX
            // https://docs.rs/regex/latest/regex/#example-verbose-mode
            .get_or_init(|| {
                Regex::new(
                    r"(?x)
                    ^
                    ([\w.]+)               # layout part
                    (                      # optional variant:
                        \( (?<var1>.+) \)  # in parentheses, X11 style
                        |
                        -  (?<var2>.+)     # or after a minus, console style
                    )?
                    $                      # must match whole input, no substring allowed
                    ",
                )
                .unwrap()
            });

        if let Some(parts) = re.captures(s) {
            let mut variant = None;
            if let Some(var1) = parts.name("var1") {
                variant = Some(var1.as_str().to_string());
            }
            if let Some(var2) = parts.name("var2") {
                variant = Some(var2.as_str().to_string());
            }
            Ok(KeymapId {
                layout: parts[1].to_string(),
                variant,
            })
        } else {
            Err(InvalidKeymap(s.to_string()))
        }
    }
}

#[cfg(test)]
mod test {
    use super::KeymapId;
    use std::str::FromStr;

    #[test]
    fn test_parse_keymap_id() {
        let keymap_id0 = KeymapId::from_str("es").unwrap();
        assert_eq!(
            KeymapId {
                layout: "es".to_string(),
                variant: None
            },
            keymap_id0
        );

        let keymap_id1 = KeymapId::from_str("es(ast)").unwrap();
        assert_eq!(
            KeymapId {
                layout: "es".to_string(),
                variant: Some("ast".to_string())
            },
            keymap_id1
        );

        let keymap_id2 = KeymapId::from_str("es-ast").unwrap();
        assert_eq!(
            KeymapId {
                layout: "es".to_string(),
                variant: Some("ast".to_string())
            },
            keymap_id2
        );

        let keymap_id3 = KeymapId::from_str("pt-nativo-us").unwrap();
        assert_eq!(
            KeymapId {
                layout: "pt".to_string(),
                variant: Some("nativo-us".to_string())
            },
            keymap_id3
        );

        let keymap_id4 = KeymapId::from_str("lt.std").unwrap();
        assert_eq!(
            KeymapId {
                layout: "lt.std".to_string(),
                variant: None
            },
            keymap_id4
        );
    }

    #[test]
    fn test_parse_keymap_id_err() {
        // no word characters for layout
        let result = KeymapId::from_str("$%&");
        assert!(result.is_err());

        // layout is there but with trailing garbage
        let result = KeymapId::from_str("cz@");
        assert!(result.is_err());

        // variant but then another variant
        let result = KeymapId::from_str("cz(qwerty)-yeah");
        assert!(result.is_err());
    }
}
