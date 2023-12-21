//! Defines useful types to deal with localization values

use regex::Regex;
use std::sync::OnceLock;
use std::{fmt::Display, str::FromStr};
use thiserror::Error;

#[derive(Clone, Debug, PartialEq)]
pub struct LocaleCode {
    // ISO-639
    pub language: String,
    // ISO-3166
    pub territory: String,
    // encoding: String,
}

impl Display for LocaleCode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}_{}", &self.language, &self.territory)
    }
}

impl Default for LocaleCode {
    fn default() -> Self {
        Self {
            language: "en".to_string(),
            territory: "US".to_string(),
        }
    }
}

#[derive(Error, Debug)]
#[error("Not a valid locale string: {0}")]
pub struct InvalidLocaleCode(String);

impl TryFrom<&str> for LocaleCode {
    type Error = InvalidLocaleCode;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        let locale_regexp: Regex = Regex::new(r"^([[:alpha:]]+)_([[:alpha:]]+)").unwrap();
        let captures = locale_regexp
            .captures(value)
            .ok_or_else(|| InvalidLocaleCode(value.to_string()))?;

        Ok(Self {
            language: captures.get(1).unwrap().as_str().to_string(),
            territory: captures.get(2).unwrap().as_str().to_string(),
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
/// assert_eq!(&id.layout, "es");
/// assert_eq!(id.variant.clone(), Some("ast".to_string()));
/// assert_eq!(id.dashed(), "es-ast".to_string());
///
/// let id_with_dashes: KeymapId = "es-ast".parse().unwrap();
/// assert_eq!(id, id_with_dashes);
/// ```
#[derive(Clone, Debug, PartialEq)]
pub struct KeymapId {
    pub layout: String,
    pub variant: Option<String>,
}

#[derive(Error, Debug)]
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
            .get_or_init(|| Regex::new(r"(\w+)((\((?<var1>\w+)\)|-(?<var2>\w+)))?").unwrap());

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
    }
}
