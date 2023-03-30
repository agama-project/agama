//! This module offers a mechanism to easily map the values from the command
//! line to proper installation settings.
//!
//! To specify a value in the command line, the user needs specify:
//!
//! * a setting ID (`"users.name"`, `"storage.lvm"`, and so on), that must be used to find the
//!   setting within a [super::settings::Settings] struct.
//! * a value, which is captured as a string (`"Foo Bar"`, `"true"`, etc.) and it should be
//!   converted to the proper type.
//!
//! Implementing the [Settings] trait adds support for setting the value in an straightforward,
//! taking care of the conversions automatically. The newtype [SettingValue] takes care of such a
//! conversion.
//!
use std::collections::HashMap;
/// For plain structs, the implementation can be derived.
///
/// TODO: derive for top-level structs too
use std::convert::TryFrom;

/// Implements support for easily settings attributes values given an ID (`"users.name"`) and a
/// string value (`"Foo bar"`).
///
/// In the example below, the trait is manually implemented for `InstallSettings` and derived for
/// `UserSettings`.
///
/// ```
/// # use agama_derive::Settings;
/// # use agama_lib::settings::{Settings, SettingValue};
///
/// #[derive(Settings)]
/// struct UserSettings {
///   name: Option<String>,
///   enabled: Option<bool>
/// }
///
/// struct InstallSettings {
///   user: UserSettings
/// }
///
/// impl Settings for InstallSettings {
///   fn set(&mut self, attr: &str, value: SettingValue) -> Result<(), &'static str> {
///     if let Some((ns, id)) = attr.split_once('.') {
///       match ns {
///         "user" => self.user.set(id, value)?,
///         _ => return Err("unknown attribute")
///       }
///     }
///     Ok(())
///   }
/// }
///
/// let user = UserSettings { name: Some(String::from("foo")), enabled: Some(false) };
/// let mut settings = InstallSettings { user };
/// settings.set("user.name", SettingValue("foo.bar".to_string()));
/// settings.set("user.enabled", SettingValue("true".to_string()));
/// assert!(&settings.user.enabled.unwrap());
/// assert_eq!(&settings.user.name.unwrap(), "foo.bar");
/// ```
pub trait Settings {
    fn add(&mut self, _attr: &str, _value: SettingObject) -> Result<(), &'static str> {
        Err("unknown collection")
    }

    fn set(&mut self, _attr: &str, _value: SettingValue) -> Result<(), &'static str> {
        Err("unknown attribute")
    }

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
///   # use agama_lib::settings::SettingValue;
//
///   let value = SettingValue("true".to_string());
///   let value: bool = value.try_into().expect("the conversion failed");
///   assert_eq!(value, true);
/// ```
#[derive(Clone)]
pub struct SettingValue(pub String);

/// Represents a string-based collection and allows converting to other types
///
/// It wraps a hash which uses String as key and SettingValue as value.
pub struct SettingObject(pub HashMap<String, SettingValue>);

impl From<HashMap<String, String>> for SettingObject {
    fn from(value: HashMap<String, String>) -> SettingObject {
        let mut hash: HashMap<String, SettingValue> = HashMap::new();
        for (k, v) in value {
            hash.insert(k, SettingValue(v));
        }
        SettingObject(hash)
    }
}

impl TryFrom<SettingValue> for bool {
    type Error = &'static str;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        match value.0.to_lowercase().as_str() {
            "true" | "yes" | "t" => Ok(true),
            "false" | "no" | "f" => Ok(false),
            _ => Err("not a valid boolean"),
        }
    }
}

impl TryFrom<SettingValue> for Option<bool> {
    type Error = &'static str;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        Ok(Some(value.try_into()?))
    }
}

impl TryFrom<SettingValue> for String {
    type Error = &'static str;

    fn try_from(value: SettingValue) -> Result<Self, Self::Error> {
        Ok(value.0)
    }
}

impl TryFrom<SettingValue> for Option<String> {
    type Error = &'static str;

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
        assert_eq!(value, true);

        let value = SettingValue("false".to_string());
        let value: bool = value.try_into().unwrap();
        assert_eq!(value, false);
    }

    #[test]
    fn test_try_from_string() {
        let value = SettingValue("some value".to_string());
        let value: String = value.try_into().unwrap();
        assert_eq!(value, "some value");
    }
}
