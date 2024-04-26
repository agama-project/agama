use anyhow::Context;
use std::collections::HashMap;
use zbus::zvariant::{self, OwnedValue, Value};

use crate::error::ServiceError;

/// Nested hash to send to D-Bus.
pub type NestedHash<'a> = HashMap<&'a str, HashMap<&'a str, zvariant::Value<'a>>>;
/// Nested hash as it comes from D-Bus.
pub type OwnedNestedHash = HashMap<String, HashMap<String, zvariant::OwnedValue>>;

/// Helper to get property of given type from ManagedObjects map or any generic dbus Hash with variant as value
pub fn get_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<T, ServiceError>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zbus::zvariant::Error>,
{
    let value: Value = properties
        .get(name)
        .context(format!("Failed to find property '{}'", name))?
        .into();
    match T::try_from(value) {
        Ok(v) => Ok(v),
        Err(e) => {
            let verr: zbus::zvariant::Error = e.into();
            let serr: ServiceError = verr.into();
            Err(serr)
        }
    }
}

pub fn get_optional_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<Option<T>, ServiceError>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zbus::zvariant::Error>,
{
    if let Some(value) = properties.get(name) {
        let value : Value = value.into();
        match T::try_from(value) {
            Ok(v) => Ok(Some(v)),
            Err(e) => {
                let verr: zbus::zvariant::Error = e.into();
                let serr: ServiceError = verr.into();
                Err(serr)
            }
        }
    } else {
        Ok(None)
    }
}