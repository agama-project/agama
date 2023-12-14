use crate::error::{ConversionError, SettingsError};
use std::collections::HashMap;
use std::convert::TryFrom;
use std::fmt::Display;

/// Implements support for easily settings attributes values given an ID (`"users.name"`) and a
/// string value (`"Foo bar"`).
pub trait Settings {
    /// Adds a new element to a collection.
    ///
    /// * `attr`: attribute name (e.g., `user.name`, `product`).
    /// * `_value`: element to add to the collection.
    fn add(&mut self, attr: &str, _value: SettingObject) -> Result<(), SettingsError> {
        Err(SettingsError::UnknownAttribute(attr.to_string()))
    }

    /// Sets an attribute's value.
    ///
    /// * `attr`: attribute name (e.g., `user.name`, `product`).
    /// * `_value`: string-based value coming from the CLI. It will automatically
    ///   converted to the underlying type.
    fn set(&mut self, attr: &str, _value: SettingValue) -> Result<(), SettingsError> {
        Err(SettingsError::UnknownAttribute(attr.to_string()))
    }

    /// Merges two settings structs.
    ///
    /// * `_other`: struct to copy the values from.
    fn merge(&mut self, _other: &Self)
    where
        Self: Sized,
    {
        unimplemented!()
    }
}

/// Represents a string-based value and allows converting them to other types
///
/// Supporting more conversions is a matter of implementing the [std::convert::TryFrom] trait for
/// more types.
///
/// ```
///   # use agama_settings::settings::SettingValue;
//
///   let value = SettingValue("true".to_string());
///   let value: bool = value.try_into().expect("the conversion failed");
///   assert_eq!(value, true);
/// ```
#[derive(Clone, Debug)]
pub struct SettingValue(pub String);

impl Display for SettingValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Represents a string-based collection and allows converting to other types
///
/// It wraps a hash which uses String as key and SettingValue as value.
#[derive(Debug)]
pub struct SettingObject(pub HashMap<String, SettingValue>);

impl SettingObject {
    /// Returns the value for the given key.
    ///
    /// * `key`: setting key.
    pub fn get(&self, key: &str) -> Option<&SettingValue> {
        self.0.get(key)
    }
}

impl From<HashMap<String, String>> for SettingObject {
    fn from(value: HashMap<String, String>) -> SettingObject {
        let mut hash: HashMap<String, SettingValue> = HashMap::new();
        for (k, v) in value {
            hash.insert(k, SettingValue(v));
        }
        SettingObject(hash)
    }
}

impl From<String> for SettingObject {
    fn from(value: String) -> SettingObject {
        SettingObject(HashMap::from([("value".to_string(), SettingValue(value))]))
    }
}

impl TryFrom<SettingObject> for String {
    type Error = ConversionError;

    fn try_from(value: SettingObject) -> Result<Self, Self::Error> {
        if let Some(v) = value.get("value") {
            return Ok(v.to_string());
        }
        Err(ConversionError::MissingKey("value".to_string()))
    }
}

impl TryFrom<SettingValue> for bool {
    type Error = ConversionError;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        match value.0.to_lowercase().as_str() {
            "true" | "yes" | "t" => Ok(true),
            "false" | "no" | "f" => Ok(false),
            _ => Err(ConversionError::InvalidValue(
                value.to_string(),
                "boolean".to_string(),
            )),
        }
    }
}

impl TryFrom<SettingValue> for Option<bool> {
    type Error = ConversionError;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        Ok(Some(value.try_into()?))
    }
}

impl TryFrom<SettingValue> for String {
    type Error = ConversionError;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        Ok(value.0)
    }
}

impl TryFrom<SettingValue> for Option<String> {
    type Error = ConversionError;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        Ok(Some(value.try_into()?))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_try_from_bool() {
        let value = SettingValue("true".to_string());
        let value: bool = value.try_into().unwrap();
        assert!(value);

        let value = SettingValue("false".to_string());
        let value: bool = value.try_into().unwrap();
        assert!(!value);

        let value = SettingValue("fasle".to_string());
        let value: Result<bool, ConversionError> = value.try_into();
        let error = value.unwrap_err();
        assert_eq!(
            error.to_string(),
            "Invalid value 'fasle', expected a boolean"
        );
    }

    #[test]
    fn test_try_from_string() {
        let value = SettingValue("some value".to_string());
        let value: String = value.try_into().unwrap();
        assert_eq!(value, "some value");
    }
}
