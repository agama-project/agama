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

//! Utilities to interact with D-Bus types.

use std::collections::HashMap;
use tokio_stream::StreamExt;
use zbus::fdo::{PropertiesChangedStream, PropertiesProxy};
use zvariant::{self, OwnedValue, Value};

/// Nested hash to send to D-Bus.
pub type NestedHash<'a> = HashMap<&'a str, HashMap<&'a str, zvariant::Value<'a>>>;
/// Nested hash as it comes from D-Bus.
pub type OwnedNestedHash = HashMap<String, HashMap<String, zvariant::OwnedValue>>;

/// Helper to get property of given type from ManagedObjects map or any generic D-Bus Hash with variant as value
pub fn get_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<T, zvariant::Error>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zvariant::Error>,
{
    let value: Value = properties
        .get(name)
        .ok_or(zvariant::Error::Message(format!(
            "Failed to find property '{}'",
            name
        )))?
        .try_into()?;

    T::try_from(value).map_err(|e| e.into())
}

/// It is similar helper like get_property with difference that name does not need to be in HashMap.
/// In such case `None` is returned, so type has to be enclosed in `Option`.
pub fn get_optional_property<'a, T>(
    properties: &'a HashMap<String, OwnedValue>,
    name: &str,
) -> Result<Option<T>, zvariant::Error>
where
    T: TryFrom<Value<'a>>,
    <T as TryFrom<Value<'a>>>::Error: Into<zvariant::Error>,
{
    if let Some(value) = properties.get(name) {
        let value: Value = value.try_into()?;
        T::try_from(value).map(|v| Some(v)).map_err(|e| e.into())
    } else {
        Ok(None)
    }
}

/// Converts a hash map containing zbus non-owned values to hash map with owned ones.
///
/// NOTE: we could follow a different approach like building our own type (e.g.
/// using the newtype idiom) and offering a better API.
///
/// * `source`: hash map containing non-onwed values ([enum@zvariant::Value]).
pub fn to_owned_hash<T: ToString>(
    source: &HashMap<T, Value<'_>>,
) -> Result<HashMap<String, OwnedValue>, zvariant::Error> {
    let mut owned = HashMap::new();
    for (key, value) in source.iter() {
        owned.insert(key.to_string(), value.try_into()?);
    }
    Ok(owned)
}

/// Monitors D-Bus property changes on a system service.
pub struct PropertiesMonitor {
    stream: PropertiesChangedStream,
}

impl PropertiesMonitor {
    /// Creates a new monitor on the system bus for the given destination and path.
    pub async fn new(destination: &'static str, path: &'static str) -> Result<Self, zbus::Error> {
        let dbus = zbus::Connection::system().await?;
        let proxy = PropertiesProxy::builder(&dbus)
            .destination(destination)?
            .path(path)?
            .build()
            .await?;
        let stream = proxy.receive_properties_changed().await?;
        Ok(Self { stream })
    }

    /// Returns the next map of changed properties, or `None` if the stream ended.
    pub async fn next(&mut self) -> Option<HashMap<String, OwnedValue>> {
        while let Some(changes) = self.stream.next().await {
            let Ok(args) = changes.args() else {
                continue;
            };

            let changes = args.changed_properties();
            let Ok(changes) = to_owned_hash(changes) else {
                continue;
            };

            return Some(changes);
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use zvariant::{self, OwnedValue, Str};

    use crate::dbus::{get_optional_property, get_property};

    #[test]
    fn test_get_property() {
        let data: HashMap<String, OwnedValue> = HashMap::from([
            ("Id".to_string(), 1_u8.into()),
            ("Device".to_string(), Str::from_static("/dev/sda").into()),
        ]);
        let id: u8 = get_property(&data, "Id").unwrap();
        assert_eq!(id, 1);

        let device: String = get_property(&data, "Device").unwrap();
        assert_eq!(device, "/dev/sda".to_string());
    }

    #[test]
    fn test_get_property_wrong_type() {
        let data: HashMap<String, OwnedValue> = HashMap::from([("Id".to_string(), 1_u8.into())]);
        let result: Result<u16, _> = get_property(&data, "Id");
        assert_eq!(result, Err(zvariant::Error::IncorrectType));
    }

    #[test]
    fn test_get_optional_property() {
        let data: HashMap<String, OwnedValue> = HashMap::from([("Id".to_string(), 1_u8.into())]);
        let id: Option<u8> = get_optional_property(&data, "Id").unwrap();
        assert_eq!(id, Some(1));

        let device: Option<String> = get_optional_property(&data, "Device").unwrap();
        assert_eq!(device, None);
    }
}
