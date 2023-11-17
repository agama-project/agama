use regex::Regex;
use thiserror::Error;

pub struct LocaleCode {
    // ISO-639
    pub language: String,
    // ISO-3166
    pub territory: String,
    // encoding: String,
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
