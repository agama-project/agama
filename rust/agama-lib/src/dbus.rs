use std::collections::HashMap;
use zbus::zvariant::{self, OwnedValue, Value};

/// Nested hash to send to D-Bus.
pub type NestedHash<'a> = HashMap<&'a str, HashMap<&'a str, zvariant::Value<'a>>>;
/// Nested hash as it comes from D-Bus.
pub type OwnedNestedHash = HashMap<String, HashMap<String, zvariant::OwnedValue>>;

/// Helper to get property of given type from ManagedObjects map or any generic D-Bus Hash with variant as value
pub fn get_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<T, zbus::zvariant::Error>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zbus::zvariant::Error>,
{
    let value: Value = properties
        .get(name)
        .ok_or(zbus::zvariant::Error::Message(format!(
            "Failed to find property '{}'",
            name
        )))?
        .into();

    T::try_from(value).map_err(|e| e.into())
}

/// It is similar helper like get_property with difference that name does not need to be in HashMap.
/// In such case `None``is returned, so type has to be enclosed in `Option`.`
pub fn get_optional_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<Option<T>, zbus::zvariant::Error>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zbus::zvariant::Error>,
{
    if let Some(value) = properties.get(name) {
        let value: Value = value.into();
        T::try_from(value).map(|v| Some(v)).map_err(|e| e.into())
    } else {
        Ok(None)
    }
}
